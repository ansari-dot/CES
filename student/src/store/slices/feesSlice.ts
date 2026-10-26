import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface FeeSummary {
  outstandingBalance: string;
  dueNotice: string;
  thisMonthChallan: string;
  thisMonthStatus: string;
  lastPaymentAmount: string;
  lastPaymentDate: string;
}

export interface ChallanItem {
  id: string;
  challanId: number;
  code: string;
  desc: string;
  amount: string;
  status: string;
  totalPayable: number;
  billingMonth: string;
  dueDate: string;
}

export interface ProofStatus {
  hasSubmitted: boolean;
  verifiedHistory: string;
  submittedAt?: string;
  referenceNo?: string;
}

export interface FeeHeadItem {
  id: number;
  head: string;
  amount: number;
  isRecurring: boolean;
  description?: string;
}

export interface StudentFeeStructure {
  student: {
    id: number;
    studentName: string;
    admissionNo: string;
    rollNo: string;
    classId: number;
    classNumber: number;
    className: string;
  };
  structure: {
    id: number;
    sessionId: number;
    academicSession: string;
    classId: number;
    totalMonthlyRecurring: number;
    effectiveFrom: string;
    status: string;
    heads: FeeHeadItem[];
  } | null;
  concessions: Array<{
    id: number;
    concessionType: string;
    value: number;
    reason: string;
    createdAt?: string;
  }>;
  discountAmount: number;
  netMonthlyRecurring: number;
}

interface FeesState {
  summary: FeeSummary;
  challans: ChallanItem[];
  proofStatus: ProofStatus;
  myStructure: StudentFeeStructure | null;
  loading: boolean;
  structureLoading: boolean;
  submitting: boolean;
}

const initialState: FeesState = {
  summary: {
    outstandingBalance: '—',
    dueNotice: '',
    thisMonthChallan: '—',
    thisMonthStatus: '',
    lastPaymentAmount: '—',
    lastPaymentDate: '',
  },
  challans: [],
  proofStatus: { hasSubmitted: false, verifiedHistory: '' },
  myStructure: null,
  loading: false,
  structureLoading: false,
  submitting: false,
};

function formatRs(amount: number): string {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

export const fetchMyFeeStructure = createAsyncThunk('fees/fetchMyStructure', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<StudentFeeStructure>('/api/v1/fees/my-structure');
  } catch (err: any) {
    return rejectWithValue(err.message || 'Failed to fetch fee schedule');
  }
});

export const fetchChallans = createAsyncThunk('fees/fetchChallans', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any[]>('/api/v1/fees/challans');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const submitPaymentProof = createAsyncThunk(
  'fees/submitProof',
  async (
    { challanId, studentId, submittedAmount, bankOrWallet, transactionReference, paymentDate, file }:
    { challanId: number; studentId?: number; submittedAmount: number; bankOrWallet: string; transactionReference: string; paymentDate: string; file?: File | null },
    { rejectWithValue }
  ) => {
    try {
      const fd = new FormData();
      fd.append('challanId', String(challanId));
      fd.append('submittedAmount', String(submittedAmount));
      fd.append('bankOrWallet', bankOrWallet);
      fd.append('transactionReference', transactionReference);
      fd.append('paymentDate', paymentDate);
      if (studentId) fd.append('studentId', String(studentId));
      if (file) fd.append('proof', file);
      return await requestApi<any>('/api/v1/fees/payment-proofs', { method: 'POST', body: fd });
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const feesSlice = createSlice({
  name: 'fees',
  initialState,
  reducers: {
    // kept for local optimistic update
    submitProof: (state, action: PayloadAction<{ referenceNo: string }>) => {
      state.proofStatus.hasSubmitted = true;
      state.proofStatus.submittedAt = new Date().toLocaleDateString();
      state.proofStatus.referenceNo = action.payload.referenceNo;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChallans.pending, (state) => { state.loading = true; })
      .addCase(fetchChallans.rejected, (state) => { state.loading = false; })
      .addCase(fetchChallans.fulfilled, (state, action) => {
        state.loading = false;
        const list: any[] = Array.isArray(action.payload) ? action.payload : [];
        if (!list.length) return;

        state.challans = list.map((ch) => {
          const total = Number(ch.totalPayable || ch.total_payable || 0);
          const paid = Number(ch.paidAmount || ch.paid_amount || 0);
          const outstanding = Math.max(0, total - paid);
          const statusRaw = (ch.status || '').toUpperCase();
          const status = statusRaw === 'PAID' ? 'Paid' : statusRaw === 'PENDING_VERIFICATION' ? 'Pending' : 'Unpaid';
          const month = ch.billingMonth || ch.billing_month || '';
          const due = ch.dueDate || ch.due_date || '';
          return {
            id: String(ch.id),
            challanId: ch.id,
            code: `${month} · #${ch.challanNumber || ch.challan_number || ch.id}`,
            desc: `Due ${due ? new Date(due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}`,
            amount: formatRs(outstanding > 0 ? outstanding : total),
            status,
            totalPayable: total,
            billingMonth: month,
            dueDate: due,
          };
        });

        // Derive summary from challans
        const unpaid = list.filter((ch) => (ch.status || '').toUpperCase() !== 'PAID');
        const totalOutstanding = unpaid.reduce((sum, ch) => {
          const total = Number(ch.totalPayable || ch.total_payable || 0);
          const paid = Number(ch.paidAmount || ch.paid_amount || 0);
          return sum + Math.max(0, total - paid);
        }, 0);

        const latest = list[0];
        const lastPaid = [...list].reverse().find((ch) => (ch.status || '').toUpperCase() === 'PAID');

        state.summary = {
          outstandingBalance: formatRs(totalOutstanding),
          dueNotice: latest?.dueDate ? `Due ${new Date(latest.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '',
          thisMonthChallan: latest ? formatRs(Number(latest.totalPayable || latest.total_payable || 0)) : '—',
          thisMonthStatus: latest ? ((latest.status || '').toUpperCase() === 'PAID' ? 'Paid' : 'Unpaid') : '',
          lastPaymentAmount: lastPaid ? formatRs(Number(lastPaid.paidAmount || lastPaid.paid_amount || lastPaid.totalPayable || 0)) : '—',
          lastPaymentDate: lastPaid?.billingMonth || '',
        };
      });

    builder
      .addCase(submitPaymentProof.pending, (state) => { state.submitting = true; })
      .addCase(submitPaymentProof.rejected, (state) => { state.submitting = false; })
      .addCase(submitPaymentProof.fulfilled, (state, action) => {
        state.submitting = false;
        state.proofStatus.hasSubmitted = true;
        state.proofStatus.submittedAt = new Date().toLocaleDateString();
        if (action.payload?.transactionReference) {
          state.proofStatus.referenceNo = action.payload.transactionReference;
        }
      })
      // Fee Structure
      .addCase(fetchMyFeeStructure.pending, (state) => {
        state.structureLoading = true;
      })
      .addCase(fetchMyFeeStructure.fulfilled, (state, action) => {
        state.structureLoading = false;
        state.myStructure = action.payload;
      })
      .addCase(fetchMyFeeStructure.rejected, (state) => {
        state.structureLoading = false;
      });
  },
});

export const { submitProof } = feesSlice.actions;
export default feesSlice.reducer;
