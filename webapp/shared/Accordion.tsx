import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import './Accordion.css';

interface AccordionContextValue {
  idPrefix: string;
  openId: string | null;
  toggleItem: (id: string) => void;
}

interface AccordionProps {
  children: ReactNode;
  initialOpenId?: string | null;
}

interface AccordionItemProps {
  id: string;
  title: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function AccordionRoot({ children, initialOpenId = null }: AccordionProps) {
  const accordionId = useId();
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const value: AccordionContextValue = {
    idPrefix: accordionId,
    openId,
    toggleItem: id => setOpenId(currentOpenId => currentOpenId === id ? null : id),
  };

  return (
    <AccordionContext.Provider value={value}>
      <div className={`accordion${openId === null ? ' accordion--closed' : ''}`}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function AccordionItem({ id, title, children, contentClassName }: AccordionItemProps) {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion.Item must be rendered inside Accordion.');
  }

  const isOpen = context.openId === id;
  const toggleId = `${context.idPrefix}-${id}-toggle`;
  const panelId = `${context.idPrefix}-${id}-panel`;

  return (
    <section className={`accordion__item${isOpen ? ' accordion__item--open' : ''}`}>
      <button
        type="button"
        className="accordion__toggle"
        id={toggleId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => context.toggleItem(id)}
      >
        <span>{title}</span>
        <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      <div
        className={`accordion__content${contentClassName ? ` ${contentClassName}` : ''}`}
        id={panelId}
        role="region"
        aria-labelledby={toggleId}
        hidden={!isOpen}
      >
        {children}
      </div>
    </section>
  );
}

const Accordion = Object.assign(AccordionRoot, { Item: AccordionItem });

export default Accordion;