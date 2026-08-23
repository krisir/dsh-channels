import type { Context } from '@deepseek-ai/cordis';
import type { StoredBinaryPart } from './message-converter.js';

export interface ChannelAttachmentContext {
  sessionId: string;
  channelId: string;
  accountId: string;
  conversationId: string;
  conversationType?: 'dm' | 'group';
  threadId?: string;
  messageId: string;
}

export interface ChannelAttachmentDescriptor {
  attachmentId: string;
  name: string;
  mimeType?: string;
  bytes: number;
  durable: boolean;
  readable: boolean;
}

export type ResolvedChannelAttachmentKind = 'image' | 'file' | 'audio' | 'video';

export interface ResolvedChannelAttachment {
  kind: ResolvedChannelAttachmentKind;
  data: Uint8Array;
  name: string;
  mimeType?: string;
}

/**
 * Optional generic-attachment capability supplied by an extension package
 * (plan §10). Core responsibility: `store` / `resolveAttachment` / session ACL.
 * Tool registration (`read_channel_attachment`) is NOT part of the core
 * contract — `installCompatibilityTools` is optional and keeps the tool
 * registered while it is the compatibility path (plan §10.1); once Harness
 * ships a native generic-attachment surface this method can be dropped.
 */
export interface ChannelAttachmentProvider {
  store(
    context: ChannelAttachmentContext,
    part: StoredBinaryPart,
  ): Promise<ChannelAttachmentDescriptor | undefined>;
  resolveAttachment(
    attachmentId: string,
    sessionId: string,
  ): Promise<ResolvedChannelAttachment>;
  installCompatibilityTools?(agentContext: Context): Promise<void>;
  /**
   * @deprecated implement {@link installCompatibilityTools} instead. Retained
   * for one compatibility cycle so providers built against the former
   * ChannelFileProvider contract keep registering their agent-scoped tools.
   */
  installTools?(agentContext: Context): Promise<void>;
}

/** @internal Install at most one provider tool hook, preferring the new name. */
export async function installAttachmentCompatibilityTools(
  provider: ChannelAttachmentProvider,
  agentContext: Context,
): Promise<void> {
  const install = provider.installCompatibilityTools ?? provider.installTools;
  await install?.call(provider, agentContext);
}

/**
 * @deprecated use {@link ChannelAttachmentProvider}
 */
export type ChannelFileProvider = ChannelAttachmentProvider;

/**
 * @deprecated use {@link ChannelAttachmentContext}
 */
export type ChannelFileContext = ChannelAttachmentContext;

/**
 * @deprecated use {@link ChannelAttachmentDescriptor}
 */
export type ChannelFileDescriptor = ChannelAttachmentDescriptor;
