import { EventEmitter } from "node:events";

export type DomainEvent =
    | {
          type: "identity_merged";
          identityGroupId: string;
          details: Record<string, unknown>;
      }
    | {
          type: "touchpoint_created";
          identityGroupId: string;
          merchantId: string;
      }
    | { type: "reward_created"; identityGroupId: string; amount: number }
    | {
          type: "purchase_attributed";
          identityGroupId: string;
          referrer?: string;
      };

export class TypedEventEmitter extends EventEmitter {
    emit<E extends DomainEvent>(eventName: E["type"], event: E): boolean {
        return super.emit(eventName, event);
    }

    on<E extends DomainEvent>(
        eventName: E["type"],
        listener: (event: E) => void
    ): this {
        return super.on(eventName, listener as (event: DomainEvent) => void);
    }

    once<E extends DomainEvent>(
        eventName: E["type"],
        listener: (event: E) => void
    ): this {
        return super.once(eventName, listener as (event: DomainEvent) => void);
    }
}

export const eventEmitter = new TypedEventEmitter();
