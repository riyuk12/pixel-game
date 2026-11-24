import { Compiler } from 'inkjs/full';

type Speaker = { name: string; portrait?: string };

/** Maps the `NAME:` prefix used in the ink script to a display name and portrait. */
const SPEAKERS: Record<string, Speaker> = {
  LAMPLIGHTER: { name: 'Old Lamplighter', portrait: '/ui/portrait_lamplighter.png' },
  YOU: { name: 'You', portrait: '/ui/portrait_player.png' },
};

const CHARS_PER_SECOND = 45;

/** Runs ink knots and drives the dialogue box: typewriter text, portraits, numbered choices. */
export class Dialogue {
  private story;
  private box = document.getElementById('dialogue')!;
  private portrait = document.getElementById('portrait') as HTMLImageElement;
  private speaker = document.getElementById('speaker')!;
  private text = document.getElementById('text')!;
  private choices = document.getElementById('choices')!;
  private full = '';
  private shown = 0;
  private choosing = false;
  active = false;

  constructor(source: string, private onTag: (tag: string) => void, private onEnd: () => void) {
    this.story = new Compiler(source).Compile();
    this.box.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#choices')) return;
      this.advance();
    });
  }

  get variables() {
    return this.story.variablesState;
  }

  start(knot: string) {
    this.story.ChoosePathString(knot);
    this.active = true;
    this.box.hidden = false;
    this.next();
  }

  /** E / Space / Enter / click: finish the typewriter, or move to the next line. */
  advance() {
    if (!this.active || this.choosing) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.textContent = this.full;
      return;
    }
    this.next();
  }

  choose(index: number) {
    if (!this.choosing || index >= this.story.currentChoices.length) return;
    this.choosing = false;
    this.choices.replaceChildren();
    this.story.ChooseChoiceIndex(index);
    this.next();
  }

  update(dt: number) {
    if (!this.active || this.shown >= this.full.length) return;
    this.shown = Math.min(this.full.length, this.shown + dt * CHARS_PER_SECOND);
    this.text.textContent = this.full.slice(0, Math.floor(this.shown));
  }

  private next() {
    while (this.story.canContinue) {
      const line = (this.story.Continue() ?? '').trim();
      for (const tag of this.story.currentTags ?? []) this.onTag(tag.trim());
      if (line) return this.showLine(line);
    }
    if (this.story.currentChoices.length) return this.showChoices();
    this.active = false;
    this.box.hidden = true;
    this.onEnd();
  }

  private showLine(line: string) {
    const m = /^([A-Z][A-Z_ ]*):\s*(.*)$/.exec(line);
    const who = m ? SPEAKERS[m[1]] ?? { name: m[1] } : undefined;
    this.setSpeaker(who);
    this.full = m ? m[2] : line;
    this.text.classList.toggle('narration', !who);
    this.shown = 0;
    this.text.textContent = '';
  }

  private showChoices() {
    this.choosing = true;
    this.setSpeaker(SPEAKERS.YOU);
    this.full = '';
    this.text.textContent = '';
    this.choices.replaceChildren(
      ...this.story.currentChoices.map((c, i) => {
        const b = document.createElement('button');
        b.textContent = `${i + 1}. ${c.text}`;
        b.addEventListener('click', () => this.choose(i));
        return b;
      }),
    );
  }

  private setSpeaker(who?: Speaker) {
    this.speaker.textContent = who?.name ?? '';
    this.speaker.hidden = !who;
    this.portrait.hidden = !who?.portrait;
    if (who?.portrait) this.portrait.src = who.portrait;
  }
}
