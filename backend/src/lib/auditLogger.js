export function logCreated(prisma, taskId, actorId) {
  return prisma.taskEvent.create({
    data: {
      eventType: "CREATED",
      taskId,
      actorId
    }
  });
}

export function logFieldChange(prisma, taskId, actorId, fieldName, oldValue, newValue) {
  return prisma.taskEvent.create({
    data: {
      eventType: "FIELD_CHANGED",
      taskId,
      actorId,
      fieldName,
      oldValue: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
      newValue: newValue !== null && newValue !== undefined ? String(newValue) : null
    }
  });
}

export function logStatusChange(prisma, taskId, actorId, oldStatus, newStatus) {
  return prisma.taskEvent.create({
    data: {
      eventType: "STATUS_CHANGED",
      taskId,
      actorId,
      oldValue: oldStatus !== null && oldStatus !== undefined ? String(oldStatus) : null,
      newValue: newStatus !== null && newStatus !== undefined ? String(newStatus) : null
    }
  });
}

export function logAssigned(prisma, taskId, actorId, assignedUserId) {
  return prisma.taskEvent.create({
    data: {
      eventType: "ASSIGNED",
      taskId,
      actorId,
      newValue: String(assignedUserId)
    }
  });
}

export function logUnassigned(prisma, taskId, actorId, unassignedUserId) {
  return prisma.taskEvent.create({
    data: {
      eventType: "UNASSIGNED",
      taskId,
      actorId,
      oldValue: String(unassignedUserId)
    }
  });
}

export function logComment(prisma, taskId, actorId, commentText) {
  return prisma.taskEvent.create({
    data: {
      eventType: "COMMENT",
      taskId,
      actorId,
      commentText
    }
  });
}
