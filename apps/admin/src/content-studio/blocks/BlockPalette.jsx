import { BLOCK_DEFINITIONS, createBlock } from './blockDefinitions.js';
import { X } from 'lucide-react';

export function BlockPalette({ dispatch, disabled, hidden = false, onAdd, onClose, definitions = BLOCK_DEFINITIONS, create = createBlock, title = 'Blocks', variant = 'sidebar', selectedBlockId = null }) {
  const button = ({ type, label, icon: Icon }) => <button key={type} type="button" aria-label={`Add ${label} block`} disabled={disabled} draggable={!disabled} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-ycoders-block-type', type); }} onClick={() => { const block = create(type); dispatch({ type: 'add', block, afterBlockId: selectedBlockId }); onAdd?.(block.blockId ?? block.id); }}><Icon aria-hidden="true" /><span>{label}</span>{variant === 'sidebar' ? <small>Add</small> : null}</button>;
  if (variant === 'toolbar') {
    const groups = definitions.reduce((items, definition) => {
      const group = definition.group ?? 'Blocks';
      let section = items.find((item) => item.name === group);
      if (!section) { section = { name: group, definitions: [] }; items.push(section); }
      section.definitions.push(definition);
      return items;
    }, []);
    return <div className="studio-block-toolbar" role="toolbar" aria-label="Insert blocks" aria-disabled={disabled || undefined}><div className="studio-block-toolbar-scroll" tabIndex="0" aria-label="Block types; scroll horizontally for more">{groups.map(({ name, definitions: entries }) => <div key={name} className="studio-block-toolbar-group" role="group" aria-label={name}><span className="studio-block-toolbar-group-label">{name}</span>{entries.map(button)}</div>)}</div></div>;
  }
  return <aside id="content-block-palette" className="content-studio-palette" aria-label="Block palette" hidden={hidden}><header><span>{title}</span>{onClose ? <button type="button" aria-label="Close blocks" onClick={onClose}><X aria-hidden="true" /></button> : null}<p>Drag into the canvas or click to add.</p></header><div className="content-studio-palette-list">{definitions.map((definition, index) => <div key={definition.type}>{definition.group && (index === 0 || definitions[index - 1]?.group !== definition.group) ? <p className="studio-palette-section">{definition.group}</p> : null}{button(definition)}</div>)}</div></aside>;
}
