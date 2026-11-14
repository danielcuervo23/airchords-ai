import { h, setAttr, setText } from './dom';
import { icon } from './icons';

export interface PickerOption { value: string; label: string; prefix?: string; detail?: string }

let uid = 0;
let openPicker: Picker | null = null;

/**
 * A selector (DESIGN.md "Selectors"): a button that shows a caption and the current value and
 * opens a list with radio semantics (a bottom sheet on phones, a popover on desktop).
 * Native radios give arrow-key navigation for free. Escape or a pick closes it and returns focus.
 */
export class Picker {
  readonly el: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly captionEl: HTMLElement;
  private readonly valueEl: HTMLElement;
  private readonly prefixEl: HTMLElement;
  private readonly sheet: HTMLDivElement;
  private readonly group: HTMLFieldSetElement;
  private readonly name = `picker-${++uid}`;
  private options: PickerOption[] = [];
  private value = '';

  constructor(
    title: string,
    caption: string,
    private readonly onPick: (value: string) => void,
    columns = 1,
  ) {
    const sheetId = `${this.name}-sheet`;
    this.captionEl = h('small', {}, caption);
    this.prefixEl = h('span', { class: 'no' });
    this.valueEl = h('span', { class: 'val' });
    this.button = h('button', { type: 'button', class: 'pick', 'aria-expanded': 'false', 'aria-controls': sheetId },
      this.captionEl, h('span', { class: 'pick-row' }, this.prefixEl, this.valueEl, icon('chev')));
    this.group = h('fieldset', { role: 'radiogroup', 'aria-label': title, class: `choices cols-${columns}` });
    this.sheet = h('div', { class: 'sheet', id: sheetId, hidden: true },
      h('p', { class: 'sheet-title', 'aria-hidden': 'true' }, title), this.group);
    this.el = h('div', { class: 'picker' }, this.button, this.sheet);

    this.button.addEventListener('click', () => (this.isOpen() ? this.close(true) : this.open()));
    this.group.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      this.close(true);
      if (input.value !== this.value) this.onPick(input.value);
    });
    // Clicking the already-checked option does not fire "change"; it should still close the sheet.
    this.group.addEventListener('click', (e) => {
      const input = (e.target as HTMLElement).closest('label')?.querySelector('input');
      if (input && input.value === this.value) this.close(true);
    });
    this.sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close(true);
      }
    });
  }

  setOptions(options: PickerOption[]): void {
    this.options = options;
    this.group.replaceChildren(
      ...options.map((o) =>
        h('label', { class: 'choice' },
          h('input', { type: 'radio', name: this.name, value: o.value }),
          o.prefix ? h('span', { class: 'no' }, o.prefix) : null,
          h('span', { class: 'choice-text' }, o.label, o.detail ? h('small', {}, o.detail) : null)),
      ),
    );
    this.syncChecked();
  }

  setValue(value: string, pending = false): void {
    this.value = value;
    const o = this.options.find((x) => x.value === value);
    setText(this.prefixEl, o?.prefix ?? '');
    setText(this.valueEl, pending ? `${o?.label ?? ''}…` : (o?.label ?? ''));
    setAttr(this.button, 'aria-busy', pending ? 'true' : null);
    this.syncChecked();
  }

  setCaption(caption: string): void {
    setText(this.captionEl, caption);
  }

  setDisabled(disabled: boolean): void {
    if (disabled) this.close(false);
    this.button.disabled = disabled;
  }

  isOpen(): boolean {
    return !this.sheet.hidden;
  }

  open(): void {
    if (openPicker && openPicker !== this) openPicker.close(false);
    openPicker = this;
    this.sheet.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    const checked = this.group.querySelector<HTMLInputElement>('input:checked') ?? this.group.querySelector('input');
    checked?.focus();
    document.addEventListener('pointerdown', this.onOutside, true);
  }

  close(returnFocus: boolean): void {
    if (this.sheet.hidden) return;
    this.sheet.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.onOutside, true);
    if (openPicker === this) openPicker = null;
    if (returnFocus) this.button.focus();
  }

  private readonly onOutside = (e: Event): void => {
    if (!this.el.contains(e.target as Node)) this.close(false);
  };

  private syncChecked(): void {
    this.group.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.checked = i.value === this.value));
  }
}
