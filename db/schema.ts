import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const inquiries=sqliteTable('site_inquiries',{
 id:text('id').primaryKey(),email:text('email').notNull(),role:text('role').notNull(),kind:text('kind').notNull(),plan:text('plan').notNull(),message:text('message').notNull(),consentVersion:text('consent_version').notNull(),createdAt:integer('created_at').notNull(),requestHash:text('request_hash').notNull(),
},table=>[index('inquiries_request_time').on(table.requestHash,table.createdAt)]);
