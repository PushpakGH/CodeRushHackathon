import { createElement, Fragment, type ReactNode } from 'react';

const propNames: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly',
  maxlength: 'maxLength', minlength: 'minLength', autocomplete: 'autoComplete',
  contenteditable: 'contentEditable', colspan: 'colSpan', rowspan: 'rowSpan',
  enctype: 'encType', novalidate: 'noValidate', autofocus: 'autoFocus',
};
const booleanAttributes = new Set(['autofocus', 'checked', 'disabled', 'hidden', 'multiple', 'open', 'readonly', 'required', 'selected', 'novalidate']);
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function parseStyle(value: string): Record<string, string> {
  return Object.fromEntries(value.split(';').map(rule => rule.trim()).filter(Boolean).map(rule => {
    const [rawName, ...parts] = rule.split(':');
    const name = rawName.trim().replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    return [name, parts.join(':').trim()];
  }));
}

function convert(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const props: Record<string, unknown> = { key };
  for (const attribute of Array.from(element.attributes)) {
    const name = propNames[attribute.name] || attribute.name;
    props[name] = booleanAttributes.has(attribute.name) ? true : attribute.name === 'style' ? parseStyle(attribute.value) : attribute.value;
  }
  if (element instanceof HTMLInputElement) {
    if (element.checked) props.defaultChecked = true;
    if (element.value) props.defaultValue = element.value;
  }
  if (element instanceof HTMLTextAreaElement && element.value) props.defaultValue = element.value;
  const children = Array.from(element.childNodes).map((child, index) => convert(child, `${key}.${index}`));
  return createElement(element.tagName.toLowerCase(), props, ...(voidTags.has(element.tagName.toLowerCase()) ? [] : children));
}

export function htmlToReact(markup: string): ReactNode {
  const parsed = new DOMParser().parseFromString(`<body>${markup}</body>`, 'text/html');
  return createElement(Fragment, null, ...Array.from(parsed.body.childNodes).map((node, index) => convert(node, String(index))));
}
