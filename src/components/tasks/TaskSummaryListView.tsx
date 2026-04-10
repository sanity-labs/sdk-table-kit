import type { SanityUser } from "@sanity/sdk-react";
import { Badge, Box, Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { Calendar, CircleDashed } from "lucide-react";

import { toPlainText } from "../../helpers/comments/addonCommentUtils";
import {
  formatCompactDisplayName,
  getTaskDueDateLabel,
  isTaskOverdue,
} from "../../helpers/tasks/TaskSummaryUtils";
import {
  findUserByResourceUserId,
  getUserDisplayNameByResourceUserId,
} from "../../helpers/users/addonUserUtils";
import type { TaskDocument } from "../../types/addonTypes";
import { TaskListMetaPill, TaskUserAvatar } from "./TaskSummaryShared";

export type TaskListFilter = "done" | "overdue" | "todo" | "unassigned";

function taskListSkeletonRowCount(
  activeFilter: TaskListFilter,
  counts: {
    doneCount: number;
    overdueCount: number;
    todoCount: number;
    unassignedCount: number;
  },
): number {
  const raw =
    activeFilter === "todo"
      ? counts.todoCount
      : activeFilter === "unassigned"
        ? counts.unassignedCount
        : activeFilter === "overdue"
          ? counts.overdueCount
          : counts.doneCount;
  if (raw > 0) return Math.min(raw, 8);
  return 1;
}

export function TaskSummaryListView({
  activeFilter,
  doneCount,
  isTasksLoading,
  onFilterChange,
  onSelectTask,
  overdueCount,
  tasks,
  todoCount,
  unassignedCount,
  users,
}: {
  activeFilter: TaskListFilter;
  doneCount: number;
  isTasksLoading: boolean;
  onFilterChange: (filter: TaskListFilter) => void;
  onSelectTask: (taskId: string) => void;
  overdueCount: number;
  tasks: TaskDocument[];
  todoCount: number;
  unassignedCount: number;
  users: SanityUser[];
}) {
  const filters: Array<{
    count: number;
    key: TaskListFilter;
    label: string;
    tone:
      | "critical"
      | "default"
      | "positive"
      | "caution"
      | "primary"
      | "neutral";
  }> = [
    { count: todoCount, key: "todo", label: "Todo", tone: "neutral" },
    {
      count: unassignedCount,
      key: "unassigned",
      label: "Unassigned",
      tone: "caution",
    },
    { count: overdueCount, key: "overdue", label: "Overdue", tone: "critical" },
    { count: doneCount, key: "done", label: "Done", tone: "positive" },
  ];

  return (
    <Stack space={3}>
      <Flex
        align="center"
        gap={2}
        style={{ flexWrap: "wrap" }}
      >
        {filters.map((filter) => {
          const disabled = filter.count === 0;
          const isActive = activeFilter === filter.key;

          return (
            <button
              disabled={disabled}
              key={filter.key}
              onClick={() => {
                if (disabled) return;
                onFilterChange(filter.key);
              }}
              style={{
                background: "transparent",
                border: 0,
                borderRadius: 999,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.55 : 1,
                outline: isActive
                  ? "2px solid var(--card-focus-ring-color, #556bfc)"
                  : "none",
                outlineOffset: 1,
                padding: 0,
              }}
              type="button"
            >
              <Badge
                padding={2}
                tone={filter.tone}
              >
                {filter.count} {filter.label}
              </Badge>
            </button>
          );
        })}
      </Flex>

      <Box style={{ maxHeight: 420, overflowY: "auto" }}>
        {tasks.length === 0 && isTasksLoading ? (
          <Stack space={2}>
            {Array.from(
              {
                length: taskListSkeletonRowCount(activeFilter, {
                  doneCount,
                  overdueCount,
                  todoCount,
                  unassignedCount,
                }),
              },
              (_, index) => (
                <TaskSummaryListItemSkeleton key={`task-skeleton-${index}`} />
              ),
            )}
          </Stack>
        ) : tasks.length === 0 ? (
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
              No tasks in this filter.
            </Text>
          </Card>
        ) : (
          <Stack space={2}>
            {tasks.map((task) => (
              <TaskSummaryListItem
                key={task._id}
                onSelect={() => onSelectTask(task._id)}
                task={task}
                users={users}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function TaskSummaryListItemSkeleton() {
  const bar = {
    background: "var(--card-muted-bg-color)",
    borderRadius: 4,
  } as const;

  return (
    <Card
      border
      padding={3}
      radius={2}
      tone="transparent"
    >
      <Stack space={3}>
        <Box style={{ ...bar, height: 16, width: "72%" }} />
        <Flex
          align="center"
          gap={2}
          style={{ flexWrap: "wrap" }}
        >
          <Box style={{ ...bar, height: 24, width: 88 }} />
          <Box style={{ ...bar, height: 24, width: 72 }} />
        </Flex>
      </Stack>
    </Card>
  );
}

function TaskSummaryListItem({
  onSelect,
  task,
  users,
}: {
  onSelect: () => void;
  task: TaskDocument;
  users: SanityUser[];
}) {
  const assignee = task.assignedTo
    ? findUserByResourceUserId(task.assignedTo, users)
    : undefined;
  const assigneeName = getUserDisplayNameByResourceUserId(
    task.assignedTo,
    users,
  );
  const compactAssigneeName =
    formatCompactDisplayName(assigneeName ?? undefined) ??
    assigneeName ??
    "Unassigned";
  const isClosed = task.status === "closed";
  const isOverdue = isTaskOverdue(task);
  const description = task.description
    ? toPlainText(task.description).trim()
    : "";
  const hasDescription = description.length > 0;

  return (
    <Button
      mode="ghost"
      onClick={onSelect}
      padding={3}
      radius={2}
      style={{ minWidth: 0, width: "100%" }}
      tone="default"
    >
      <Stack space={3}>
        <Text
          size={2}
          weight="semibold"
          style={{
            color: isClosed ? "var(--card-muted-fg-color)" : undefined,
            minWidth: 0,
            overflowX: "clip",
            textDecoration: isClosed ? "line-through" : undefined,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </Text>

        {hasDescription && (
          <Text
            muted
            size={1}
            style={{
              whiteSpace: "normal",
            }}
          >
            {description}
          </Text>
        )}

        <Flex
          align="center"
          gap={2}
          style={{ flexWrap: "wrap" }}
        >
          <TaskListMetaPill>
            {assignee ? (
              <TaskUserAvatar user={assignee} />
            ) : (
              <CircleDashed size={12} />
            )}
            <Text size={1}>{compactAssigneeName}</Text>
          </TaskListMetaPill>
          <TaskListMetaPill tone={isOverdue ? "critical" : "default"}>
            <Calendar size={12} />
            <Text size={1}>{getTaskDueDateLabel(task) ?? "No date"}</Text>
          </TaskListMetaPill>
        </Flex>
      </Stack>
    </Button>
  );
}
