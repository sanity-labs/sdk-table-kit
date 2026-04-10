import { AddonDatasetRuntimeProvider } from "@sanity-labs/sdk-addon-dataset-runtime";
import { useTasksByDocumentType } from "@sanity-labs/sdk-tasks";
import type { SanityUser } from "@sanity/sdk-react";
import React, {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AddonDataContextValue, TaskDocument } from "../types/addonTypes";

const AddonDataCtx = createContext<AddonDataContextValue | null>(null);

interface AddonDataProviderProps {
  addonDataset: string;
  children: ReactNode;
  contentDataset?: string;
  docType: string;
  projectId: string;
  users?: SanityUser[];
  workspaceId?: string;
  workspaceTitle?: string;
}

class AddonErrorBoundaryInner extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[AddonErrorBoundary] caught error:", error.message, error);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function AddonDataProvider({
  addonDataset,
  children,
  contentDataset,
  docType,
  projectId,
  users,
  workspaceId,
  workspaceTitle,
}: AddonDataProviderProps) {
  const [tasksByDocId, setTasksByDocId] = useState<Map<string, TaskDocument[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  const handleTasks = useCallback(
    (nextTasksByDocId: Map<string, TaskDocument[]>, pending: boolean) => {
      // useTasksByDocumentType uses useQuery: while isPending, data is undefined so the grouped map
      // is empty. Keep the previous map during pending empty snapshots so chips/list do not flash.
      setTasksByDocId((prev) => {
        if (pending && nextTasksByDocId.size === 0 && prev.size > 0) {
          return prev;
        }
        return new Map(nextTasksByDocId);
      });
      setIsLoading(pending);
    },
    [],
  );

  const patchTasks = useCallback(
    (docRef: string, updater: (tasks: TaskDocument[]) => TaskDocument[]) => {
      setTasksByDocId((prev) => {
        const next = new Map(prev);
        const current = next.get(docRef) ?? [];
        const updated = updater(current);

        if (updated.length > 0) {
          next.set(docRef, updated);
        } else {
          next.delete(docRef);
        }

        return next;
      });
    },
    [],
  );

  const value = useMemo<AddonDataContextValue>(
    () => ({
      addonDataset,
      contentDataset,
      isLoading,
      patchTasks,
      projectId,
      tasksByDocId,
      users,
      workspaceId,
      workspaceTitle,
    }),
    [
      addonDataset,
      contentDataset,
      isLoading,
      patchTasks,
      projectId,
      tasksByDocId,
      users,
      workspaceId,
      workspaceTitle,
    ],
  );

  return (
    <AddonDatasetRuntimeProvider
      addonDataset={addonDataset}
      contentDataset={contentDataset}
      projectId={projectId}
      workspaceId={workspaceId}
      workspaceTitle={workspaceTitle}
    >
      <AddonDataCtx.Provider value={value}>
        <AddonErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <TasksFetchBridge
              addonDataset={addonDataset}
              docType={docType}
              onTasks={handleTasks}
              projectId={projectId}
            />
          </Suspense>
        </AddonErrorBoundary>
        {children}
      </AddonDataCtx.Provider>
    </AddonDatasetRuntimeProvider>
  );
}

export function useAddonData(): AddonDataContextValue {
  const ctx = useContext(AddonDataCtx);
  if (!ctx) {
    throw new Error("useAddonData must be used inside <AddonDataProvider>");
  }

  return ctx;
}

export function useOptionalAddonData(): AddonDataContextValue | null {
  return useContext(AddonDataCtx);
}

function AddonErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  return (
    <AddonErrorBoundaryInner fallback={fallback}>
      {children}
    </AddonErrorBoundaryInner>
  );
}

function TasksFetchBridge({
  addonDataset,
  docType,
  onTasks,
  projectId,
}: {
  addonDataset: string;
  docType: string;
  onTasks: (
    tasksByDocumentId: Map<string, TaskDocument[]>,
    pending: boolean,
  ) => void;
  projectId: string;
}) {
  const { isPending, tasksByDocumentId } = useTasksByDocumentType({
    addonDataset,
    documentType: docType,
    projectId,
  });

  useEffect(() => {
    onTasks(tasksByDocumentId, isPending);
  }, [isPending, onTasks, tasksByDocumentId]);

  return null;
}
