import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="font-page-title text-[28px] font-bold text-on-surface mb-2">
        Page Not Found
      </h1>
      <p className="font-caption text-[14px] text-on-surface-variant max-w-md mb-6">
        The route you requested does not exist or has been moved in the operational cockpit.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="h-10 px-5 rounded-xl bg-primary text-white font-medium text-[13px] hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </button>
    </div>
  );
};
