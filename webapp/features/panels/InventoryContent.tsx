import type { InventoryItem } from '../../shared/types';

function InventoryContent({ inventory }: { inventory: InventoryItem[] | null }) {
  if (inventory === null) {
    return <p className="inventory-message">Chargement de l’inventaire...</p>;
  }
  if (inventory.length === 0) {
    return <p className="inventory-message">L’inventaire est vide.</p>;
  }

  const orderedInventory = [...inventory].sort((first, second) => {
    const firstEquipped = first.equipped > 0;
    const secondEquipped = second.equipped > 0;

    if (firstEquipped !== secondEquipped) {
      return firstEquipped ? -1 : 1;
    }
    if (firstEquipped) {
      return first.equipped - second.equipped;
    }
    return first.type.localeCompare(second.type);
  });

  return (
    <ul className="inventory-items">
      {orderedInventory.map(item => (
        <li key={item.id}>
          <p><strong>{item.name || item.type}</strong> { item.identified ? null : <small>Non identifié</small>} {item.magic && <>{item.magic}</>}</p>
          <small>{[item.type, formatEquipped(item.equipped)].filter(Boolean).join(' - ')}</small>
          {item.description && item.type!=='Composant' && <small>{item.description}</small>}
          <small>Poids: {formatWeight(item.weight)}{item.durability ? ` - Durabilité: ${item.durability}` : ''}</small>
        </li>
      ))}
    </ul>
  );
}

function formatEquipped(equipped: number): string | null {
  if (equipped > 0) {
    return 'Équipé';
  }
  if (equipped === -1) {
    return 'Balluchonné';
  }
  if (equipped < 0) {
    return 'Dans le sac';
  }
  return null;
}
function formatWeight(weight: number | string): string {
  return typeof weight === 'number' ? `${weight} minute${weight > 1 ? 's' : ''}` : weight;
}
export default InventoryContent;