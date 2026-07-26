import { ArchiveIndexItem } from '../lib/wordTypes';

interface ArchiveListItemProps {
  item: ArchiveIndexItem;
  onSelect: (date: string) => void;
}

export function ArchiveListItem({ item, onSelect }: ArchiveListItemProps) {
  return (
    <li>
      <button className="archive-list-item" onClick={() => onSelect(item.date)}>
        <span>{item.date}</span>
        <strong>{item.word}</strong>
        <span>{item.meaningKo}</span>
      </button>
    </li>
  );
}
