import { useState, useId } from 'react';
import './Input.css';

/**
 * Input component with floating label
 * type: text | password | email | search
 */
export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder = ' ',
  className = '',
  ...rest
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const inputType = type === 'password' ? (show ? 'text' : 'password') : type;

  return (
    <div className={`input-wrapper ${error ? 'has-error' : ''} ${className}`}>
      {type === 'search' && (
        <span className="input-icon-left" aria-hidden="true">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="m16.5 16.5 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      )}

      <input
        id={id}
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`input-field ${type === 'search' ? 'has-icon-left' : ''} ${type === 'password' ? 'has-icon-right' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />

      {label && (
        <label htmlFor={id} className="input-label">{label}</label>
      )}

      {type === 'password' && (
        <button
          type="button"
          className="input-icon-right"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show
            ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
          }
        </button>
      )}

      {error && (
        <span id={`${id}-error`} className="input-error" role="alert">{error}</span>
      )}
    </div>
  );
}
