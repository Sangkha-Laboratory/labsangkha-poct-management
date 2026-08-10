import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: string | number;
  onChange: (e: { target: { value: any } }) => void;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export default function CustomSelect({ value, onChange, children, className, required, disabled, onKeyDown }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse children to extract options
  const options = React.Children.toArray(children).reduce((acc: any[], child: any) => {
    if (React.isValidElement(child) && (child.type === 'option' || (child.props && (child.props as any).value !== undefined))) {
      acc.push({
        value: (child.props as any).value,
        label: (child.props as any).children
      });
    }
    return acc;
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef} onKeyDown={onKeyDown}>
      <div 
        className={`flex items-center justify-between cursor-pointer ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : ''}</span>
        <ChevronDown size={16} className="text-slate-400 ml-2 shrink-0" />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full min-w-max max-w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {options.map((opt, idx) => (
            <div
              key={idx}
              className={`px-3 py-2 text-xs cursor-pointer hover:bg-sky-50 whitespace-normal break-words ${String(value) === String(opt.value) ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700'}`}
              onClick={() => {
                onChange({ target: { value: opt.value } });
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
