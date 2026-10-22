import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Search, BookOpen, Calendar, Video, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const quickLinks = [
    { title: "Join Mathematics Live Class", icon: Video, route: "/student/classes" },
    { title: "Check Timetable for Today", icon: Calendar, route: "/student/timetable" },
    { title: "Download Fractions Notes PDF", icon: FileText, route: "/student/learning" },
    { title: "Submit Fractions Worksheet", icon: BookOpen, route: "/student/homework" },
  ];

  const filtered = quickLinks.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (route: string) => {
    navigate(route);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Portal & Lessons" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-sm border border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Type a subject, class, or resource..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none text-foreground"
            autoFocus
          />
        </div>

        <div className="divide-y divide-border">
          {filtered.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSelect(item.route)}
                className="w-full py-3 flex items-center justify-between text-left hover:bg-muted/50 px-2 rounded-sm transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-sm bg-secondary flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
