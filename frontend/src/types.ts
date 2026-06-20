export type Role = 'ADMIN' | 'RESIDENT';
export type UserStatus = 'NORMAL' | 'OBSERVATION';
export type TopicStage = 'PUBLIC_NOTICE' | 'DISCUSSION' | 'VOTING' | 'ARCHIVED';
export type VoteChoice = 'AGREE' | 'DISAGREE' | 'ABSTAIN';
export type VoteResult = 'PASSED' | 'REJECTED' | 'PENDING';

export interface UserInfo {
  id: string;
  username: string;
  realName: string;
  roomNumber: string;
  role: Role;
  status: UserStatus;
  consecutiveMiss?: number;
}

export interface StageLog {
  id: string;
  fromStage: TopicStage | null;
  toStage: TopicStage;
  remark: string | null;
  createdAt: string;
  operator: { realName: string };
}

export interface TopicListItem {
  id: string;
  title: string;
  description: string;
  stage: TopicStage;
  voteResult: VoteResult;
  createdAt: string;
  creator: { realName: string };
  _count: { votes: number; stageLogs: number };
}

export interface TopicDetail extends TopicListItem {
  publicNoticeAt: string;
  discussionAt: string | null;
  votingAt: string | null;
  archivedAt: string | null;
  stageLogs: StageLog[];
}

export interface VoteRecord {
  id: string;
  choice: VoteChoice;
  createdAt: string;
  user: { realName: string; roomNumber: string; username: string };
  topicId: string;
}

export interface VoteStats {
  participation: number;
  totalResidents: number;
  participationRate: number;
  agree: number;
  disagree: number;
  abstain: number;
  effective: number;
  agreeRate: number;
  passed: boolean;
}

export interface Resident {
  id: string;
  username: string;
  realName: string;
  roomNumber: string;
  status: UserStatus;
  consecutiveMiss: number;
  createdAt: string;
}

export const STAGE_LABEL: Record<TopicStage, string> = {
  PUBLIC_NOTICE: '公示期',
  DISCUSSION: '讨论期',
  VOTING: '表决期',
  ARCHIVED: '归档',
};

export const CHOICE_LABEL: Record<VoteChoice, string> = {
  AGREE: '同意',
  DISAGREE: '反对',
  ABSTAIN: '弃权',
};

export const RESULT_LABEL: Record<VoteResult, string> = {
  PASSED: '通过',
  REJECTED: '未通过',
  PENDING: '待表决',
};

export const STAGE_COLOR: Record<TopicStage, string> = {
  PUBLIC_NOTICE: '#e6f4ff',
  DISCUSSION: '#f6ffed',
  VOTING: '#fff7e6',
  ARCHIVED: '#f5f5f5',
};

export const CHOICE_COLOR: Record<VoteChoice, string> = {
  AGREE: '#52c41a',
  DISAGREE: '#ff4d4f',
  ABSTAIN: '#8c8c8c',
};
