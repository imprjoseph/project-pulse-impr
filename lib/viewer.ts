import { getChatGPTUser, requireChatGPTUser } from '@/app/chatgpt-auth';

export type Viewer = { userId: string; displayName: string; email: string; isPreview: boolean };

const demoViewer: Viewer = {
  userId: 'local-preview-joseph',
  displayName: 'Joseph',
  email: 'joseph@impr.com.tw',
  isPreview: true,
};

export async function getPageViewer(returnTo: string): Promise<Viewer> {
  const user = await getChatGPTUser();
  if (user) return { userId: user.userId, displayName: user.displayName, email: user.email, isPreview: false };
  if (process.env.NODE_ENV !== 'production') return demoViewer;
  const required = await requireChatGPTUser(returnTo);
  return { userId: required.userId, displayName: required.displayName, email: required.email, isPreview: false };
}

export async function getApiViewer(): Promise<Viewer | null> {
  const user = await getChatGPTUser();
  if (user) return { userId: user.userId, displayName: user.displayName, email: user.email, isPreview: false };
  if (process.env.NODE_ENV !== 'production') return demoViewer;
  return null;
}
