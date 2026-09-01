export const LEGAL_TRANSITIONS = {
  BACKLOG: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS', 'IN_REVIEW'],
  DONE: ['IN_PROGRESS']
};

export function validateTransition(from, to) {
  if (from === to) {
    return { valid: true };
  }

  const allowedMoves = LEGAL_TRANSITIONS[from];
  
  if (!allowedMoves) {
    return { valid: false, reason: `Invalid starting status: ${from}` };
  }

  if (allowedMoves.includes(to)) {
    return { valid: true };
  }

  if (from === 'BACKLOG' && to === 'DONE') {
    return { 
      valid: false, 
      reason: "Cannot move from BACKLOG to DONE. Task must go through IN_PROGRESS and IN_REVIEW first." 
    };
  }

  return { 
    valid: false, 
    reason: `Cannot move from ${from} to ${to}. Allowed moves are: ${allowedMoves.join(', ')}.` 
  };
}

export function getBlockedFrom(currentStatus) {
  if (currentStatus === 'IN_PROGRESS' || currentStatus === 'IN_REVIEW') {
    return currentStatus;
  }
  return null;
}
