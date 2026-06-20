import { z } from 'zod';
import { TopicStage, VoteChoice } from '@prisma/client';

export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export const createTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().min(1, '描述不能为空'),
});

export const advanceStageSchema = z.object({
  remark: z.string().optional(),
});

export const voteSchema = z.object({
  choice: z.nativeEnum(VoteChoice),
});

export const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  realName: z.string().min(1),
  roomNumber: z.string().min(1),
});

export function validate(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err: any) {
      res.status(400).json({
        error: '参数校验失败',
        details: err.errors ? err.errors.map((e: any) => e.message) : undefined,
      });
    }
  };
}
