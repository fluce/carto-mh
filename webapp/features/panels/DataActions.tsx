interface DataActionsProps {
  pending: boolean;
  error: string | null;
  onUpdate: () => Promise<void>;
}

function DataActions({ pending, error, onUpdate }: DataActionsProps) {
  return (
    <div className="data-actions">
      <button type="button" onClick={onUpdate} disabled={pending}>
        {pending ? 'Mise à jour...' : 'Mettre à jour les données'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default DataActions;