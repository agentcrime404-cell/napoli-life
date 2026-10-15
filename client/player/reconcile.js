const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Lascia guidare la predizione locale durante l'input; lo scarto piccolo è il
// normale ritardo del server e correggerlo a scatto annulla visivamente il moto.
export function reconcileLocalPosition(player, targetX, targetY, frameSeconds, moving, {
 deadZone = .9,
 maxCorrectionRate = 8,
 response = moving ? 4 : 5,
 snapDistance = 12
} = {}) {
 if (!player || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return 0;
 const dx = targetX - player.x, dy = targetY - player.y, distance = Math.hypot(dx, dy);
 if (!Number.isFinite(distance) || distance < 1e-4) return 0;
 if (distance >= snapDistance) {
  player.x = targetX;
  player.y = targetY;
  return distance;
 }
 if (moving && distance <= deadZone) return 0;
 const dt = clamp(Number(frameSeconds) || 0, 0, .1);
 if (!dt) return 0;
 const gain = Math.min(1 - Math.exp(-response * dt), maxCorrectionRate * dt / distance);
 player.x += dx * gain;
 player.y += dy * gain;
 return distance * gain;
}
