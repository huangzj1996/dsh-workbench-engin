/**
 * The localisation card: `<root>/<id>/<id>-context.md`.
 *
 * It is written once when a workbench is created and handed to an AI as
 * context; it never takes part in rendering and config saves never rewrite it,
 * so its wording is a template rather than a generated summary. The `id` is the
 * one identity in the card that must stay in sync with the JSON, hence the
 * explicit line for it.
 */
import type { WorkbenchScene } from './schema';

/** Placeholder purpose used when the workbench has no description yet. */
export const CONTEXT_CARD_PURPOSE_PLACEHOLDER = '（待补充）';

/** Build the initial `<id>-context.md` body for one workbench. */
export function contextCardMarkdown(
  scene: Pick<WorkbenchScene, 'id' | 'name' | 'description'>,
): string {
  const purpose =
    scene.description !== undefined && scene.description.trim() !== ''
      ? scene.description.trim()
      : CONTEXT_CARD_PURPOSE_PLACEHOLDER;
  const id = scene.id;

  return [
    `# ${scene.name}`,
    '',
    `> 工作台 id：\`${id}\``,
    '',
    '## 用途',
    '',
    purpose,
    '',
    '## 边界',
    '',
    `- 这份说明是给 AI 的上下文，不参与渲染；工作台的权威配置是 \`${id}/${id}.json\`。`,
    '- 修改这份说明不会影响工作台界面；修改 JSON 才会。',
    '- 只描述这个工作台本身，不写跨工作台的约定。',
    '',
    '## 可以放什么',
    '',
    '- 这个工作台解决什么问题、做到什么算完成（成功标准）。',
    '- 各个子面板各自负责什么、彼此怎么配合。',
    '- 供 AI 参考的背景资料、术语与既有约定。',
    '',
    '## 不要放什么',
    '',
    '- 密码、令牌、私钥等敏感信息。',
    '- 与这个工作台无关的通用资料。',
    '- 需要实时同步的状态（以 JSON 文件和界面为准）。',
    '',
  ].join('\n');
}
