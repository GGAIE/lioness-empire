import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  title,
  close,
  children,
  role = 'dialog',
  statusBar,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
  statusBar?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current,
      previous = document.activeElement as HTMLElement | null;
    d?.showModal();
    return () => {
      d?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      role={role}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header className={statusBar ? 'modal-header-with-status' : undefined}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button onClick={close} aria-label="關閉視窗">
            ✕
          </button>
        </div>
        {statusBar}
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
