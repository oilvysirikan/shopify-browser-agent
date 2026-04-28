declare module 'bullmq' {
  import { EventEmitter } from 'events';

  export interface Job<T = any, R = any, N extends string = string> extends EventEmitter {
    id?: string;
    name: N;
    data: T;
    opts: any;
    progress: number;
    attemptsMade: number;
    delay: number;
    timestamp: number;
    stacktrace: string[];
    returnvalue: R;
    failedReason: string;
    processedOn: number | null;
    finishedOn: number | null;
    processedBy?: string;
    
    getState(): Promise<string>;
    update(data: T): Promise<void>;
    updateData(data: T): Promise<void>;
    progress(value: any): Promise<void>;
    log(row: string): Promise<any>;
    retry(): Promise<void>;
    moveToCompleted(returnValue: R, ignoreLock?: boolean, notFetch?: boolean): Promise<[any, Job] | null>;
    moveToFailed(error: Error, ignoreLock?: boolean, notFetch?: boolean): Promise<[any, Job] | null>;
    promote(): Promise<void>;
    discard(): Promise<void>;
    releaseLock(): Promise<void>;
    remove(): Promise<void>;
    toJSON(): any;
  }

  export interface Queue<T = any, R = any, N extends string = string> extends EventEmitter {
    name: string;
    client: any;
    
    add(name: N, data: T, opts?: any): Promise<Job<T, R, N>>;
    addBulk(jobs: { name: N; data: T; opts?: any }[]): Promise<Job<T, R, N>[]>;
    getJob(jobId: string): Promise<Job<T, R, N> | null>;
    getJobs(types?: string[], start?: number, end?: number, asc?: boolean): Promise<Job<T, R, N>[]>;
    getJobCounts(...types: string[]): Promise<{ [index: string]: number }>;
    getCompleted(): Promise<Job<T, R, N>[]>;
    getFailed(): Promise<Job<T, R, N>[]>;
    getDelayed(): Promise<Job<T, R, N>[]>;
    getActive(): Promise<Job<T, R, N>[]>;
    getWaiting(): Promise<Job<T, R, N>[]>;
    getPaused(): Promise<Job<T, R, N>[]>;
    getActiveCount(): Promise<number>;
    getCompletedCount(): Promise<number>;
    getFailedCount(): Promise<number>;
    getDelayedCount(): Promise<number>;
    getWaitingCount(): Promise<number>;
    pause(isLocal?: boolean, doNotWaitActive?: boolean): Promise<void>;
    resume(isLocal?: boolean): Promise<void>;
    clean(grace: number, limit: number, type?: string): Promise<Job<T, R, N>[]>;
    empty(): Promise<void>;
    close(doNotWaitJobs?: boolean): Promise<void>;
    obliterate(opts?: { force?: boolean; count?: number }): Promise<void>;
    process(processor: (job: Job<T, R, N>) => Promise<R>): void;
    on(event: string, listener: Function): this;
    on(event: 'active', listener: (job: Job<T, R, N>) => void): this;
    on(event: 'completed', listener: (job: Job<T, R, N>, result: R) => void): this;
    on(event: 'failed', listener: (job: Job<T, R, N> | undefined, error: Error) => void): this;
    on(event: 'stalled', listener: (job: Job<T, R, N>) => void): this;
    on(event: 'progress', listener: (job: Job<T, R, N>, progress: any) => void): this;
    on(event: 'removed', listener: (job: Job<T, R, N>) => void): this;
    on(event: 'drained', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export interface QueueSchedulerOptions {
    maxStalledCount?: number;
    stalledInterval?: number;
    lockDuration?: number;
    lockRenewTime?: number;
  }

  export class QueueScheduler {
    constructor(name: string, opts?: QueueSchedulerOptions);
    isRunning(): boolean;
    close(): Promise<void>;
  }

  export interface WorkerOptions {
    concurrency?: number;
    lockDuration?: number;
    lockRenewTime?: number;
    runRetryDelay?: number;
    settings?: {
      lockDuration?: number;
      lockRenewTime?: number;
      stalledInterval?: number;
      maxStalledCount?: number;
      guardInterval?: number;
      retryProcessDelay?: number;
      drainDelay?: number;
    };
  }

  export class Worker<T = any, R = any, N extends string = string> extends EventEmitter {
    constructor(name: string, processor: (job: Job<T, R, N>) => Promise<R>, opts?: WorkerOptions);
    isRunning(): boolean;
    close(force?: boolean): Promise<void>;
    on(event: string, listener: Function): this;
    on(event: 'active', listener: (job: Job<T, R, N>) => void): this;
    on(event: 'completed', listener: (job: Job<T, R, N>, result: R) => void): this;
    on(event: 'failed', listener: (job: Job<T, R, N> | undefined, error: Error) => void): this;
    on(event: 'stalled', listener: (jobId: string) => void): this;
    on(event: 'progress', listener: (job: Job<T, R, N>, progress: any) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export class Queue<T = any, R = any, N extends string = string> {
    constructor(name: string, opts?: {
      connection?: any;
      defaultJobOptions?: any;
      settings?: any;
    });
  }
}
