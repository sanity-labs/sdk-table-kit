import {
  CalendarPopoverContent,
  formatDateOnlyString,
  parseDateOnlyString,
} from "@sanity-labs/react-table-kit";
import type { SanityUser } from "@sanity/sdk-react";
import {
  Box,
  Button,
  Card,
  Flex,
  Label,
  Menu,
  MenuButton,
  MenuItem,
  Popover,
  Stack,
  Text,
  TextInput,
  TextArea,
  useClickOutsideEvent,
} from "@sanity/ui";
import {
  Bell,
  BellOff,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
} from "lucide-react";

import { CheckmarkIcon } from "@sanity/icons";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DayPicker } from "react-day-picker";

import { useAddonData } from "../../context/AddonDataContext";
import {
  buildMessageFromPlainText,
  buildTaskCommentDocument,
  toPlainText,
} from "../../helpers/comments/addonCommentUtils";
import {
  formatCompactDisplayName,
  formatDateValueForDisplay,
  getDateInputValue,
  getStudioTaskUrl,
  isDateValueOverdue,
  toDueDateIsoString,
} from "../../helpers/tasks/TaskSummaryUtils";
import { findUserByResourceUserId } from "../../helpers/users/addonUserUtils";
import { useAddonTaskMutations } from "../../hooks/useAddonTaskMutations";
import { useCurrentResourceUserId } from "../../hooks/useCurrentResourceUserId";
import { useSafeToast } from "../../hooks/useSafeToast";
import { useTaskCommentMutations } from "../../hooks/useTaskCommentMutations";
import { useTaskComments } from "../../hooks/useTaskComments";
import type { TaskDocument, TaskStatus } from "../../types/addonTypes";
import {
  SharedCommentsPanel,
  type SharedCommentsAdapter,
} from "../comments/SharedCommentsPanel";
import { TaskSummaryAssignPicker } from "./TaskSummaryAssignPicker";
import { TaskActionsMenu, TaskUserAvatar } from "./TaskSummaryShared";

const PLACEHOLDER_TITLE = "Untitled task";
const TEXT_AUTOSAVE_DEBOUNCE_MS = 350;

export type TaskSummaryEditorViewProps = {
  documentId: string;
  documentType: string;
  onBack: () => void;
  onTaskMaterialized: (taskId: string) => void;
  onDeleteOptimistic?: (taskId: string) => void;
  onDeleteRollback?: (taskId: string) => void;
  onInternalInteraction?: (durationMs?: number) => void;
  onRegisterFlushPending?: (flushFn: null | (() => Promise<boolean>)) => void;
  task: TaskDocument | undefined;
  users: SanityUser[];
};

export function TaskSummaryEditorView({
  documentId,
  documentType,
  onBack,
  onDeleteOptimistic,
  onDeleteRollback,
  onInternalInteraction,
  onRegisterFlushPending,
  onTaskMaterialized,
  task,
  users,
}: TaskSummaryEditorViewProps) {
  const { workspaceId, workspaceTitle } = useAddonData();
  const currentResourceUserId = useCurrentResourceUserId();
  const { createTask, editTask, removeTask } = useAddonTaskMutations();
  const toast = useSafeToast();

  const [bootstrapTaskId, setBootstrapTaskId] = useState<null | string>(null);
  const [assignedToDraft, setAssignedToDraft] = useState<string | undefined>(
    () => task?.assignedTo,
  );
  const [descriptionDraft, setDescriptionDraft] = useState(() =>
    task ? toPlainText(task.description ?? []).trim() : "",
  );
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false);
  const [isDueDateEditorOpen, setIsDueDateEditorOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(() => task?.title ?? "");
  const [dueDateValue, setDueDateValue] = useState(() =>
    task ? getDateInputValue(task.dueBy) : "",
  );
  const [optimisticTaskStatus, setOptimisticTaskStatus] =
    useState<TaskStatus | null>(null);

  const assignButtonRef = useRef<HTMLButtonElement>(null);
  const assignPickerRef = useRef<HTMLDivElement>(null);
  const dueDateButtonRef = useRef<HTMLButtonElement>(null);
  const dueDateEditorRef = useRef<HTMLDivElement>(null);
  const titleAutosaveTimerRef = useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );
  const descriptionAutosaveTimerRef = useRef<null | ReturnType<
    typeof setTimeout
  >>(null);
  const inFlightSavesRef = useRef<{
    description: null | Promise<boolean>;
    title: null | Promise<boolean>;
  }>({
    description: null,
    title: null,
  });
  const latestDraftRef = useRef({
    description: task ? toPlainText(task.description ?? []).trim() : "",
    title: task?.title ?? "",
  });
  const lastSavedRef = useRef({
    description: task ? toPlainText(task.description ?? []).trim() : "",
    title: task?.title ?? "",
  });
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastResetTaskIdRef = useRef<null | string>(task?._id ?? null);
  const materializePromiseRef = useRef<Promise<string> | null>(null);

  const effectiveTaskId = task?._id ?? bootstrapTaskId;
  const assignee = assignedToDraft
    ? findUserByResourceUserId(assignedToDraft, users)
    : undefined;
  const compactAssigneeName =
    formatCompactDisplayName(assignee?.profile?.displayName) ??
    assignee?.profile?.displayName ??
    "Unassigned";

  const effectiveTaskStatus: TaskStatus =
    optimisticTaskStatus ?? task?.status ?? "open";
  const isOverdue = isDateValueOverdue(
    dueDateValue || undefined,
    effectiveTaskStatus,
  );
  const isSubscribed = currentResourceUserId
    ? (task?.subscribers ?? []).includes(currentResourceUserId)
    : false;
  const studioUrlForMenu = useMemo(() => {
    if (!effectiveTaskId) return "";
    if (task) return getStudioTaskUrl(task, workspaceId);
    return getStudioTaskUrl(
      {
        _createdAt: "",
        _id: effectiveTaskId,
        _type: "tasks.task",
        _updatedAt: "",
        authorId: "",
        status: "open",
        title: titleDraft.trim() || PLACEHOLDER_TITLE,
      },
      workspaceId,
    );
  }, [effectiveTaskId, task, titleDraft, workspaceId]);

  const selectedDueDate = parseDateOnlyString(dueDateValue || undefined);

  const commentTaskForHooks: TaskDocument | null = useMemo(() => {
    if (!effectiveTaskId) return null;
    if (task) return task;
    return {
      _createdAt: new Date().toISOString(),
      _id: effectiveTaskId,
      _type: "tasks.task",
      _updatedAt: new Date().toISOString(),
      authorId: "",
      status: "open",
      subscribers: [],
      title: titleDraft.trim() || PLACEHOLDER_TITLE,
    };
  }, [effectiveTaskId, task, titleDraft]);

  // When leaving a loaded task (e.g. back to list / create draft), allow the next task id to run reset logic.
  useEffect(() => {
    if (!task?._id) {
      lastResetTaskIdRef.current = null;
    }
  }, [task]);

  useEffect(() => {
    if (!task?._id) return;
    if (lastResetTaskIdRef.current === task._id) return;

    // First wire payload for a task we just materialized: server fields can lag behind typing — do not
    // overwrite title/description (avoids snapping the input back to e.g. "n" while the user keeps typing).
    if (bootstrapTaskId && task._id === bootstrapTaskId) {
      setBootstrapTaskId(null);
      lastResetTaskIdRef.current = task._id;
      setAssignedToDraft(task.assignedTo);
      setDueDateValue(getDateInputValue(task.dueBy));
      setIsAssignPickerOpen(false);
      setIsDueDateEditorOpen(false);
      return;
    }

    lastResetTaskIdRef.current = task._id;

    const nextDescription = toPlainText(task.description ?? []).trim();

    setAssignedToDraft(task.assignedTo);
    setDescriptionDraft(nextDescription);
    setDueDateValue(getDateInputValue(task.dueBy));
    setIsAssignPickerOpen(false);
    setIsDueDateEditorOpen(false);
    setTitleDraft(task.title);

    latestDraftRef.current = {
      description: nextDescription,
      title: task.title,
    };
    lastSavedRef.current = { description: nextDescription, title: task.title };
  }, [bootstrapTaskId, task]);

  useEffect(() => {
    latestDraftRef.current = {
      description: descriptionDraft,
      title: titleDraft,
    };
  }, [descriptionDraft, titleDraft]);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, [task?._id]);

  useEffect(() => {
    setOptimisticTaskStatus(null);
  }, [task?._id]);

  useEffect(() => {
    if (
      optimisticTaskStatus !== null &&
      task?.status === optimisticTaskStatus
    ) {
      setOptimisticTaskStatus(null);
    }
  }, [optimisticTaskStatus, task?.status]);

  const autoGrowDescription = useCallback(() => {
    const textarea = descriptionTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoGrowDescription();
  }, [autoGrowDescription, descriptionDraft]);

  const clearTitleAutosaveTimer = useCallback(() => {
    if (!titleAutosaveTimerRef.current) return;
    clearTimeout(titleAutosaveTimerRef.current);
    titleAutosaveTimerRef.current = null;
  }, []);

  const clearDescriptionAutosaveTimer = useCallback(() => {
    if (!descriptionAutosaveTimerRef.current) return;
    clearTimeout(descriptionAutosaveTimerRef.current);
    descriptionAutosaveTimerRef.current = null;
  }, []);

  const ensureTaskId = useCallback(async (): Promise<string> => {
    if (task?._id) return task._id;
    if (bootstrapTaskId) return bootstrapTaskId;
    if (materializePromiseRef.current) return materializePromiseRef.current;

    const promise = (async () => {
      // Use refs for create payload: `setTitleDraft` / `setDescriptionDraft` are async — on first
      // keystroke `titleDraft` state is still the previous render's value.
      const { description: draftDescription, title: draftTitle } =
        latestDraftRef.current;
      const titleForCreate = draftTitle.trim() || PLACEHOLDER_TITLE;
      const descriptionForCreate = draftDescription.trim();

      const created = await createTask(
        documentId,
        documentType,
        titleForCreate,
        assignedToDraft,
        dueDateValue ? toDueDateIsoString(dueDateValue) : undefined,
        descriptionForCreate.length > 0
          ? buildMessageFromPlainText(descriptionForCreate)
          : undefined,
      );
      const id = created._id;
      setBootstrapTaskId(id);
      lastSavedRef.current = {
        description: descriptionForCreate,
        title: titleForCreate,
      };
      latestDraftRef.current = {
        description: draftDescription,
        title: draftTitle,
      };
      onTaskMaterialized(id);
      return id;
    })();

    materializePromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      materializePromiseRef.current = null;
    }
  }, [
    assignedToDraft,
    bootstrapTaskId,
    createTask,
    documentId,
    documentType,
    dueDateValue,
    onTaskMaterialized,
    task?._id,
  ]);

  const saveTitleNow = useCallback(
    async (value: string) => {
      const normalized = value.trim();

      if (normalized === lastSavedRef.current.title) return true;

      const taskId = await ensureTaskId();

      const savePromise = editTask(taskId, { title: normalized })
        .then(() => {
          lastSavedRef.current.title = normalized;
          return true;
        })
        .catch((error) => {
          console.error("[TaskSummaryEditorView] saveTitleNow failed", {
            error,
            taskId,
            title: normalized,
          });
          toast.push({
            status: "error",
            title: "Failed to save task title.",
          });
          return false;
        })
        .finally(() => {
          if (inFlightSavesRef.current.title === savePromise) {
            inFlightSavesRef.current.title = null;
          }
        });

      inFlightSavesRef.current.title = savePromise;
      return await savePromise;
    },
    [editTask, ensureTaskId, toast],
  );

  const saveDescriptionNow = useCallback(
    async (value: string) => {
      if (value === lastSavedRef.current.description) return true;

      const taskId = await ensureTaskId();

      const savePromise = editTask(taskId, {
        description: buildMessageFromPlainText(value),
      })
        .then(() => {
          lastSavedRef.current.description = value;
          return true;
        })
        .catch((error) => {
          console.error("[TaskSummaryEditorView] saveDescriptionNow failed", {
            description: value,
            error,
            taskId,
          });
          toast.push({
            status: "error",
            title: "Failed to save task description.",
          });
          return false;
        })
        .finally(() => {
          if (inFlightSavesRef.current.description === savePromise) {
            inFlightSavesRef.current.description = null;
          }
        });

      inFlightSavesRef.current.description = savePromise;
      return await savePromise;
    },
    [editTask, ensureTaskId, toast],
  );

  const scheduleTitleAutosave = useCallback(
    (nextTitle: string) => {
      clearTitleAutosaveTimer();
      titleAutosaveTimerRef.current = setTimeout(() => {
        titleAutosaveTimerRef.current = null;
        void saveTitleNow(nextTitle);
      }, TEXT_AUTOSAVE_DEBOUNCE_MS);
    },
    [clearTitleAutosaveTimer, saveTitleNow],
  );

  const scheduleDescriptionAutosave = useCallback(
    (nextDescription: string) => {
      clearDescriptionAutosaveTimer();
      descriptionAutosaveTimerRef.current = setTimeout(() => {
        descriptionAutosaveTimerRef.current = null;
        void saveDescriptionNow(nextDescription);
      }, TEXT_AUTOSAVE_DEBOUNCE_MS);
    },
    [clearDescriptionAutosaveTimer, saveDescriptionNow],
  );

  const flushPendingWrites = useCallback(async () => {
    if (!effectiveTaskId) {
      return true;
    }

    let success = true;

    const hasUnsavedEmptyTitle =
      latestDraftRef.current.title.trim().length === 0 &&
      latestDraftRef.current.title !== lastSavedRef.current.title;
    if (hasUnsavedEmptyTitle) {
      success = (await saveTitleNow(latestDraftRef.current.title)) && success;
    }

    if (titleAutosaveTimerRef.current) {
      clearTitleAutosaveTimer();
      success = (await saveTitleNow(latestDraftRef.current.title)) && success;
    }

    if (descriptionAutosaveTimerRef.current) {
      clearDescriptionAutosaveTimer();
      success =
        (await saveDescriptionNow(latestDraftRef.current.description)) &&
        success;
    }

    const inFlightSaves = [
      inFlightSavesRef.current.title,
      inFlightSavesRef.current.description,
    ].filter((candidate): candidate is Promise<boolean> => Boolean(candidate));

    for (const inFlightSave of inFlightSaves) {
      success = (await inFlightSave) && success;
    }

    return success;
  }, [
    clearDescriptionAutosaveTimer,
    clearTitleAutosaveTimer,
    effectiveTaskId,
    saveDescriptionNow,
    saveTitleNow,
  ]);

  useEffect(() => {
    onRegisterFlushPending?.(flushPendingWrites);
    return () => {
      onRegisterFlushPending?.(null);
    };
  }, [flushPendingWrites, onRegisterFlushPending]);

  useEffect(
    () => () => {
      clearTitleAutosaveTimer();
      clearDescriptionAutosaveTimer();
    },
    [clearDescriptionAutosaveTimer, clearTitleAutosaveTimer],
  );

  useClickOutsideEvent(
    isAssignPickerOpen ? () => setIsAssignPickerOpen(false) : undefined,
    () => [assignButtonRef.current, assignPickerRef.current],
  );
  useClickOutsideEvent(
    isDueDateEditorOpen ? () => setIsDueDateEditorOpen(false) : undefined,
    () => [dueDateButtonRef.current, dueDateEditorRef.current],
  );

  const handleBack = useCallback(async () => {
    if (!effectiveTaskId) {
      onInternalInteraction?.();
      onBack();
      return;
    }
    onInternalInteraction?.();
    const canNavigateBack = await flushPendingWrites();
    if (!canNavigateBack) return;
    onBack();
  }, [effectiveTaskId, flushPendingWrites, onBack, onInternalInteraction]);

  const handleAssign = useCallback(
    async (resourceUserId: string | undefined) => {
      const previousAssignee = assignedToDraft;
      setAssignedToDraft(resourceUserId);
      setIsAssignPickerOpen(false);
      onInternalInteraction?.(500);

      const taskId = await ensureTaskId();

      editTask(taskId, { assignedTo: resourceUserId ?? "" }).catch((error) => {
        console.error("[TaskSummaryEditorView] handleAssign failed", {
          assignedTo: resourceUserId,
          error,
          taskId,
        });
        setAssignedToDraft(previousAssignee);
        toast.push({
          status: "error",
          title: "Failed to update assignee.",
        });
      });
    },
    [assignedToDraft, editTask, ensureTaskId, onInternalInteraction, toast],
  );

  const handleDelete = useCallback(async () => {
    if (!effectiveTaskId) return;
    onInternalInteraction?.(3000);
    onDeleteOptimistic?.(effectiveTaskId);
    if (!onDeleteOptimistic) {
      onBack();
    }
    try {
      await removeTask(effectiveTaskId);
    } catch {
      onDeleteRollback?.(effectiveTaskId);
    }
  }, [
    effectiveTaskId,
    onBack,
    onDeleteOptimistic,
    onDeleteRollback,
    onInternalInteraction,
    removeTask,
  ]);

  const handleSelectDueDate = useCallback(
    async (date: Date | undefined) => {
      if (!date) return;

      const previousDueDateValue = dueDateValue;
      const nextDueDateValue = formatDateOnlyString(date);
      setDueDateValue(nextDueDateValue);
      setIsDueDateEditorOpen(false);
      onInternalInteraction?.(500);

      const taskId = await ensureTaskId();

      editTask(taskId, { dueBy: toDueDateIsoString(nextDueDateValue) }).catch(
        (error) => {
          console.error("[TaskSummaryEditorView] handleSelectDueDate failed", {
            dueBy: nextDueDateValue,
            error,
            taskId,
          });
          setDueDateValue(previousDueDateValue);
          toast.push({
            status: "error",
            title: "Failed to update due date.",
          });
        },
      );
    },
    [dueDateValue, editTask, ensureTaskId, onInternalInteraction, toast],
  );

  const handleToggleSubscription = useCallback(async () => {
    if (!currentResourceUserId) return;
    const taskId = await ensureTaskId();
    const currentSubscribers = task?.subscribers ?? [];
    const nextSubscribers = isSubscribed
      ? currentSubscribers.filter(
          (subscriber) => subscriber !== currentResourceUserId,
        )
      : [...new Set([...currentSubscribers, currentResourceUserId])];
    editTask(taskId, { subscribers: nextSubscribers }).catch((error) => {
      console.error("[TaskSummaryEditorView] handleToggleSubscription failed", {
        error,
        nextSubscribers,
        taskId,
      });
      toast.push({
        status: "error",
        title: "Failed to update subscription.",
      });
    });
  }, [
    currentResourceUserId,
    editTask,
    ensureTaskId,
    isSubscribed,
    task?.subscribers,
    toast,
  ]);

  const handleSelectTaskStatus = useCallback(
    async (nextStatus: TaskStatus) => {
      const currentEffective = optimisticTaskStatus ?? task?.status ?? "open";
      if (nextStatus === currentEffective) return;

      setOptimisticTaskStatus(nextStatus);
      onInternalInteraction?.(500);

      try {
        const taskId = await ensureTaskId();
        await editTask(taskId, { status: nextStatus });
      } catch (error) {
        console.error("[TaskSummaryEditorView] handleSelectTaskStatus failed", {
          error,
          nextStatus,
        });
        setOptimisticTaskStatus(null);
        toast.push({
          status: "error",
          title: "Failed to update task status.",
        });
      }
    },
    [
      editTask,
      ensureTaskId,
      onInternalInteraction,
      optimisticTaskStatus,
      task?.status,
      toast,
    ],
  );

  const onTitleChange = useCallback(
    async (nextTitle: string) => {
      setTitleDraft(nextTitle);
      latestDraftRef.current.title = nextTitle;
      if (!task?._id) {
        await ensureTaskId();
      }
      scheduleTitleAutosave(nextTitle);
    },
    [ensureTaskId, scheduleTitleAutosave, task?._id],
  );

  const onDescriptionChange = useCallback(
    async (nextDescription: string) => {
      setDescriptionDraft(nextDescription);
      latestDraftRef.current.description = nextDescription;
      if (!task?._id) {
        await ensureTaskId();
      }
      scheduleDescriptionAutosave(nextDescription);
    },
    [ensureTaskId, scheduleDescriptionAutosave, task?._id],
  );

  return (
    <Stack space={4}>
      <Flex
        align="center"
        gap={2}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Button
          icon={<ChevronLeft size={16} />}
          mode="bleed"
          onClick={() => {
            void handleBack();
          }}
          padding={3}
        />
        <div style={{ flex: 1 }}>
          <Stack space={2}>
            <TextInput
              autoFocus
              onBlur={() => {
                void flushPendingWrites();
              }}
              onChange={(event) => {
                void onTitleChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void flushPendingWrites();
                }
              }}
              placeholder="Task title..."
              ref={titleInputRef}
              value={titleDraft}
            />
          </Stack>
        </div>
        <TaskActionsMenu
          disabled={!effectiveTaskId}
          onDelete={handleDelete}
          studioUrl={studioUrlForMenu}
        />
      </Flex>
      <Flex
        align="center"
        gap={2}
        style={{ flexWrap: "wrap" }}
      >
        <MenuButton
          button={
            <Button
              aria-label="Task status"
              fontSize={1}
              icon={
                effectiveTaskStatus === "closed" ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <CircleDashed size={12} />
                )
              }
              mode="ghost"
              padding={2}
              text={effectiveTaskStatus === "closed" ? "Done" : "To Do"}
            />
          }
          id="task-status-menu"
          menu={
            <Menu>
              <MenuItem onClick={() => void handleSelectTaskStatus("open")}>
                <Box>
                  <Flex
                    align="center"
                    gap={2}
                  >
                    <CircleDashed size={16} />
                    <Text size={1}>To Do</Text>
                    {effectiveTaskStatus === "open" && <CheckmarkIcon />}
                  </Flex>
                </Box>
              </MenuItem>
              <MenuItem onClick={() => void handleSelectTaskStatus("closed")}>
                <Box>
                  <Flex
                    align="center"
                    gap={2}
                  >
                    <CheckCircle2 size={16} />
                    <Text size={1}>Done</Text>
                    {effectiveTaskStatus === "closed" && <CheckmarkIcon />}
                  </Flex>
                </Box>
              </MenuItem>
            </Menu>
          }
          popover={{ portal: false }}
        />

        <Popover
          animate
          content={
            <TaskSummaryAssignPicker
              currentAssignee={assignedToDraft}
              layout="popoverContent"
              onAssign={(resourceUserId) => {
                void handleAssign(resourceUserId);
              }}
              pickerRef={assignPickerRef}
              users={users}
            />
          }
          open={isAssignPickerOpen}
          placement="bottom-start"
          portal={false}
        >
          <Button
            fontSize={1}
            icon={
              assignee ? (
                <TaskUserAvatar user={assignee} />
              ) : (
                <CircleDashed size={12} />
              )
            }
            mode="ghost"
            onClick={() => setIsAssignPickerOpen((current) => !current)}
            padding={2}
            ref={assignButtonRef}
            text={compactAssigneeName}
          />
        </Popover>

        <Popover
          animate
          content={
            <CalendarPopoverContent popoverRef={dueDateEditorRef}>
              <Stack space={3}>
                <DayPicker
                  defaultMonth={selectedDueDate}
                  mode="single"
                  onSelect={handleSelectDueDate}
                  selected={selectedDueDate}
                  showOutsideDays
                />
                <Flex justify="flex-end">
                  <Button
                    disabled={!dueDateValue}
                    fontSize={1}
                    mode="bleed"
                    onClick={() => {
                      void (async () => {
                        const previousDueDateValue = dueDateValue;
                        setDueDateValue("");
                        setIsDueDateEditorOpen(false);
                        onInternalInteraction?.(500);
                        const taskId = await ensureTaskId();
                        editTask(taskId, { dueBy: "" }).catch((error) => {
                          console.error(
                            "[TaskSummaryEditorView] clearDueDate failed",
                            {
                              error,
                              taskId,
                            },
                          );
                          setDueDateValue(previousDueDateValue);
                          toast.push({
                            status: "error",
                            title: "Failed to clear due date.",
                          });
                        });
                      })();
                    }}
                    text="Clear"
                  />
                </Flex>
              </Stack>
            </CalendarPopoverContent>
          }
          open={isDueDateEditorOpen}
          placement="bottom-start"
          portal={false}
        >
          <Button
            fontSize={1}
            icon={<Calendar size={12} />}
            mode="ghost"
            onClick={() => setIsDueDateEditorOpen((current) => !current)}
            padding={2}
            ref={dueDateButtonRef}
            text={formatDateValueForDisplay(dueDateValue || undefined)}
            tone={isOverdue ? "critical" : "default"}
          />
        </Popover>
      </Flex>

      <Stack space={2}>
        <Label
          muted
          size={1}
        >
          Description
        </Label>
        <TextArea
          onBlur={() => {
            void flushPendingWrites();
          }}
          onChange={(event) => {
            void onDescriptionChange(event.target.value);
          }}
          placeholder="Add a description..."
          ref={descriptionTextareaRef}
          rows={3}
          width="100%"
          value={descriptionDraft}
        />
      </Stack>

      <Box
        style={{
          borderTop: "1px solid var(--card-border-color)",
          paddingTop: 16,
        }}
      >
        {!effectiveTaskId ? (
          <TaskCommentsPlaceholder />
        ) : (
          <Suspense
            fallback={
              <TaskDetailCommentsFallback
                isSubscribed={isSubscribed}
                onToggleSubscription={handleToggleSubscription}
              />
            }
          >
            <TaskDetailCommentsSection
              currentResourceUserId={currentResourceUserId}
              isSubscribed={isSubscribed}
              onToggleSubscription={handleToggleSubscription}
              task={commentTaskForHooks!}
              workspaceId={workspaceId}
              workspaceTitle={workspaceTitle}
            />
          </Suspense>
        )}
      </Box>
    </Stack>
  );
}

function TaskCommentsPlaceholder() {
  return (
    <Stack space={3}>
      <Flex
        align="center"
        justify="space-between"
      >
        <Text
          size={1}
          weight="semibold"
        >
          Comments
        </Text>
        <Button
          disabled
          icon={<BellOff size={16} />}
          mode="bleed"
          padding={2}
          text="Subscribe"
        />
      </Flex>
      <Card
        border
        padding={3}
        radius={2}
        tone="transparent"
      >
        <Text
          muted
          size={1}
        >
          Add details to start this task — comments will appear here once the
          task is created.
        </Text>
      </Card>
    </Stack>
  );
}

function TaskDetailCommentsSection({
  currentResourceUserId,
  isSubscribed,
  onToggleSubscription,
  task,
  workspaceId,
  workspaceTitle,
}: {
  currentResourceUserId: string | undefined;
  isSubscribed: boolean;
  onToggleSubscription: () => void;
  task: TaskDocument;
  workspaceId?: string;
  workspaceTitle?: string;
}) {
  const taskCommentsState = useTaskComments(task._id);
  const taskCommentMutations = useTaskCommentMutations(task);
  const studioUrl = getStudioTaskUrl(task, workspaceId);

  const commentAdapter = useMemo<SharedCommentsAdapter>(
    () => ({
      buildOptimisticComment: ({
        authorId,
        commentId,
        message,
        parentCommentId,
        threadId,
      }) =>
        buildTaskCommentDocument({
          authorId,
          commentId,
          message,
          parentCommentId,
          subscribers: task.subscribers,
          taskId: task._id,
          taskStudioUrl: studioUrl,
          taskTitle: task.title,
          threadId,
          workspaceId,
          workspaceTitle,
        }),
      createComment: ({ commentId, message, parentCommentId, threadId }) =>
        taskCommentMutations.createComment(
          message,
          parentCommentId,
          threadId,
          commentId,
        ),
    }),
    [studioUrl, task, taskCommentMutations, workspaceId, workspaceTitle],
  );

  return (
    <SharedCommentsPanel
      commentAdapter={commentAdapter}
      commentsState={taskCommentsState}
      documentId={task._id}
      documentTitle={task.title}
      documentType="tasks.task"
      headerActions={
        <Button
          icon={isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
          mode="bleed"
          onClick={onToggleSubscription}
          padding={2}
          text={isSubscribed ? "Subscribed" : "Subscribe"}
        />
      }
      headerTitle="Comments"
      placeholder={
        currentResourceUserId ? "Add a comment..." : "Sign in to post comments"
      }
    />
  );
}

function TaskDetailCommentsFallback({
  isSubscribed,
  onToggleSubscription,
}: {
  isSubscribed: boolean;
  onToggleSubscription: () => void;
}) {
  return (
    <Stack space={3}>
      <Flex
        align="center"
        justify="space-between"
      >
        <Text
          size={1}
          weight="semibold"
        >
          Comments
        </Text>
        <Button
          icon={isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
          mode="bleed"
          onClick={onToggleSubscription}
          padding={2}
          text={isSubscribed ? "Subscribed" : "Subscribe"}
        />
      </Flex>
      <Card
        border
        padding={3}
        radius={2}
        tone="transparent"
      >
        <Text
          muted
          size={1}
        >
          Loading comments...
        </Text>
      </Card>
    </Stack>
  );
}
