import { z } from 'astro:content';

export const ToolSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  status: z.enum(['可用', '开发中', '规划中']).default('规划中'),
  order: z.number().optional(),
});

export type Tool = z.infer<typeof ToolSchema>;
export const tools: Tool[] = [];
