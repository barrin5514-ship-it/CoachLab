// Reuses the same optional Fitness controls in manual and AI lesson forms.
import React from 'react';
import { fitnessClassTypes, fitnessFormats } from './fitness.js';
// The parent owns values so changing discipline can clear hidden Fitness details.
export default function FitnessFields({ value, onChange }) {
  if (value.discipline !== 'Fitness') return null;
  return <div className="form-row">
    <label>Class type<select value={value.class_type || ''} onChange={event => onChange({ class_type: event.target.value, class_type_other: '' })}><option value="">Not specified</option>{fitnessClassTypes.map(type => <option key={type}>{type}</option>)}</select></label>
    {value.class_type === 'Other' && <label>Other class type<input required maxLength={40} value={value.class_type_other || ''} onChange={event => onChange({ class_type_other: event.target.value })} /><small>Up to 40 characters. No personal information.</small></label>}
    <label>Format<select value={value.class_format || ''} onChange={event => onChange({ class_format: event.target.value })}><option value="">Not specified</option>{fitnessFormats.map(format => <option key={format}>{format}</option>)}</select></label>
  </div>;
}
