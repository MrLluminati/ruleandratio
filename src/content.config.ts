import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {z} from 'astro/zod';

const articles=defineCollection({
 loader:glob({base:'./src/content/articles',pattern:'**/*.md'}),
 schema:z.object({
 title:z.string().min(1),
 description:z.string().min(1),
 type:z.enum(['news','judgment','legislation','procedure','research','education','institution']),
 areas:z.array(z.string()).min(1),
 jurisdiction:z.string().min(1),
 author:z.string().min(1),
 reviewer:z.string().optional(),
 publishedAt:z.coerce.date().optional(),
 reviewedAt:z.coerce.date().optional(),
 sources:z.array(z.object({title:z.string().min(1),url:z.string().url()})).default([]),
 draft:z.boolean().default(true),
 }).refine(data=>data.draft || Boolean(data.reviewer && data.publishedAt && data.reviewedAt && data.sources.length),{message:'Non-draft articles require reviewer, publication and review dates, and at least one source.'}),
});
export const collections={articles};
