import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface EditableCardProps {
  title: string;
  children: React.ReactNode;
  editChildren: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  saveError?: string | null;
  canEdit?: boolean;
}

export function EditableCard({
  title,
  children,
  editChildren,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving = false,
  saveSuccess = false,
  saveError = null,
  canEdit = true,
}: EditableCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const borderColor = saveError
    ? '#EF4444'
    : saveSuccess
    ? '#34D399'
    : isEditing
    ? '#FBBF24'
    : '#222222';

  return (
    <div
      className="rounded-lg border p-4 transition-all"
      style={{
        backgroundColor: '#0A0A0A',
        borderColor,
        boxShadow: saveError
          ? '0 0 10px rgba(239, 68, 68, 0.2)'
          : saveSuccess
          ? '0 0 10px rgba(52, 211, 153, 0.2)'
          : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
          {title}
        </p>
        {canEdit && !isEditing && (
          <button
            onClick={onEdit}
            className="transition-opacity"
            style={{
              opacity: isHovered ? 1 : 0,
              color: '#6B7280',
            }}
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
        {isEditing && (
          <div className="flex items-center gap-1">
            {isSaving ? (
              <span className="text-xs" style={{ color: '#FBBF24' }}>Saving...</span>
            ) : (
              <>
                <button onClick={onSave} style={{ color: '#34D399' }} title="Save">
                  <Check size={14} />
                </button>
                <button onClick={onCancel} style={{ color: '#6B7280' }} title="Cancel">
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? editChildren : children}

      {/* Error message */}
      {saveError && (
        <p className="text-xs mt-2" style={{ color: '#EF4444' }}>
          {saveError}
        </p>
      )}
    </div>
  );
}
