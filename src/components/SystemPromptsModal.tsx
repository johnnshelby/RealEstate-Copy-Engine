import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { FileCode2, X, Loader2, Copy, Check } from 'lucide-react';

interface PromptData {
  name: string;
  description: string;
  content: string;
}

export const SystemPromptsModal = ({ onClose }: { onClose: () => void }) => {
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system-prompts')
      .then(res => res.json())
      .then(data => {
        setPrompts(data.prompts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-brand-cream w-full max-w-4xl max-h-[85vh] rounded-2xl border-4 border-brand-green shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-brand-green px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-brand-gold" />
            <div>
              <h2 className="text-brand-cream font-bold text-lg leading-tight tracking-tight">系統 Prompt 指令庫</h2>
              <p className="text-[10px] text-brand-gold/80 uppercase font-mono tracking-widest">System Prompts viewer</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-brand-green-dark hover:bg-black/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-brand-gold" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-brand-green animate-spin" />
              <p className="text-sm font-bold text-brand-body animate-pulse">讀取系統指令中...</p>
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-20 text-brand-body/60">
              無法載入 Prompt 資料。
            </div>
          ) : (
            prompts.map((prompt, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-brand-beige overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-4 py-3 border-b border-brand-beige flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-brand-green">{prompt.name}</h3>
                    <p className="text-[11px] text-brand-body/70 mt-0.5">{prompt.description}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(prompt.content, `prompt-${idx}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand-beige hover:border-brand-gold hover:text-brand-gold rounded text-xs font-semibold text-brand-body transition-colors"
                  >
                    {copied === `prompt-${idx}` ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-500" /> 已複製</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> 複製 Prompt</>
                    )}
                  </button>
                </div>
                <div className="p-4 bg-slate-900 overflow-x-auto">
                  <pre className="text-[11px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                    {prompt.content}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
