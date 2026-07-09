/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Attachment } from '../../types';
import { 
  Trash2, 
  Globe, 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  File 
} from 'lucide-react';

export const getAttachmentIcon = (type: 'file' | 'drive' | 'link', name: string) => {
  if (type === 'drive') {
    return <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') {
    return <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
  }
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) {
    return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
    return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return <FileImage className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
  }
  return <File className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
};

interface AttachmentItemProps {
  attachment: Attachment;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
}

const AttachmentItem: React.FC<AttachmentItemProps> = ({
  attachment,
  onDelete,
  showDelete = true
}) => {
  return (
    <div className="group relative flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-teal-200 transition">
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        <div className="p-1.5 bg-white rounded-lg border border-slate-150 shadow-sm shrink-0">
          {getAttachmentIcon(attachment.type, attachment.name)}
        </div>
        <div className="min-w-0 text-left">
          <div className="text-xs font-bold text-slate-755 truncate group-hover:text-teal-600 transition" title={attachment.name}>
            {attachment.name}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
            {attachment.type === 'drive' ? 'Google Drive Link' : attachment.size || 'Attached File'} &bull; by {attachment.uploadedBy}
          </div>
        </div>
      </a>
      
      {showDelete && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(attachment.id)}
          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
          title="Remove Attachment"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default AttachmentItem;
