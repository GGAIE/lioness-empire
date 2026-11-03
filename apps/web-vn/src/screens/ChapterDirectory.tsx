import { useState } from 'react';
import type { GameState, Story } from '../../../../packages/narrative-core/schema';
import { chapterDirectory, navigableScenes } from '../../../../packages/narrative-core/directory';
import type { Meta } from '../storage/saves';

export function ChapterDirectory({
  story,
  meta,
  state,
  started,
  busy,
  unlocked,
  onRead,
}: {
  story: Story;
  meta: Meta;
  state: GameState;
  started: boolean;
  busy: boolean;
  unlocked: boolean;
  onRead: (id: string, current: boolean) => void;
}) {
  const current = started ? story.scenes[state.currentSceneId] : undefined;
  const chapters = chapterDirectory(story, [...meta.read, ...state.readSegments], state);
  const available = navigableScenes(story, state, unlocked);
  const [expanded, setExpanded] = useState(
    () => new Set(current ? [current.chapter, `${current.chapter}:${current.act}`] : [])
  );
  const toggle = (id: string, open: boolean) =>
    setExpanded((s) => {
      if (s.has(id) === open) return s;
      const n = new Set(s);
      if (open) n.add(id);
      else n.delete(id);
      return n;
    });
  return (
    <div className="chapter-directory">
      <div className="directory-intro">
        <div>
          <span>STORY CONTENTS</span>
          <p>依章節、幕與小節閱讀。切換前會保存目前進度，已選路線保持不變。</p>
        </div>
        <div className="directory-tools">
          <button
            onClick={() =>
              setExpanded(
                new Set(chapters.flatMap((c) => [c.id, ...c.acts.map((a) => `${c.id}:${a.id}`)]))
              )
            }
          >
            展開全部
          </button>
          <button onClick={() => setExpanded(new Set())}>收合全部</button>
        </div>
      </div>
      {chapters.map((chapter) => {
        const sections = chapter.acts.flatMap((a) => a.sections);
        const authored = chapter.acts.filter((a) => a.sections.length).length;
        const count = sections.filter((s) => s.read).length;
        return (
          <article className="directory-chapter" key={chapter.id}>
            <details
              open={expanded.has(chapter.id)}
              onToggle={(e) => toggle(chapter.id, e.currentTarget.open)}
            >
              <summary>
                <span className="directory-number">{chapter.number}</span>
                <div>
                  <h3>{chapter.title}</h3>
                  <p>
                    {sections.length
                      ? `已提供 ${authored} / ${chapter.acts.length} 幕 · 已讀 ${count} / ${sections.length} 節${authored < chapter.acts.length ? ' · 後續待續' : ''}`
                      : '尚未開放'}
                  </p>
                </div>
                {current?.chapter === chapter.id && (
                  <span className="directory-tag current">閱讀中</span>
                )}
                <span className="directory-chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="directory-acts">
                {chapter.acts.map((act) => {
                  const actKey = `${chapter.id}:${act.id}`;
                  return (
                    <details
                      className="directory-act"
                      key={act.id}
                      open={expanded.has(actKey)}
                      onToggle={(e) => {
                        e.stopPropagation();
                        toggle(actKey, e.currentTarget.open);
                      }}
                    >
                      <summary>
                        <div>
                          <h4>
                            {act.label} · {act.title}
                          </h4>
                          <p>
                            {act.sections.length
                              ? `${act.sections.length} 節 · 已讀 ${act.sections.filter((s) => s.read).length} 節`
                              : '尚未開放'}
                          </p>
                        </div>
                        <span className="directory-chevron" aria-hidden="true">
                          ⌄
                        </span>
                      </summary>
                      {act.sections.length ? (
                        <ol className="directory-sections">
                          {act.sections.map((section) => {
                            const isCurrent = !!current && section.sceneIds.includes(current.id);
                            const unlocked = available.has(section.id);
                            return (
                              <li key={section.id}>
                                <button
                                  className={isCurrent ? 'is-current' : ''}
                                  disabled={busy || !unlocked}
                                  onClick={() => onRead(section.id, isCurrent)}
                                >
                                  <span className="directory-section-number">
                                    {String(section.number).padStart(2, '0')}
                                  </span>
                                  <span className="directory-section-title">
                                    {section.title}
                                    <small>
                                      {isCurrent
                                        ? '閱讀中'
                                        : section.read
                                          ? '已讀'
                                          : unlocked
                                            ? '尚未閱讀'
                                            : '請先完成前面的選擇'}
                                    </small>
                                  </span>
                                  <span className="directory-read-action">
                                    {isCurrent ? '繼續本節' : section.read ? '重讀' : '閱讀'}{' '}
                                    <span aria-hidden="true">→</span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="directory-pending">後續故事，敬請期待。</p>
                      )}
                    </details>
                  );
                })}
              </div>
            </details>
          </article>
        );
      })}
    </div>
  );
}
