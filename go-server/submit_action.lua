-- Atomic submit_action — replaces WATCH/MULTI/EXEC for the hot path.
--
-- KEYS[1] = ki_clash:game:<id>
-- ARGV[1] = player_id
-- ARGV[2] = action (e.g. "charge")
-- ARGV[3] = ttl in seconds
--
-- Returns one of:
--   {"missing"}                              -- game not in Redis
--   {"not_in_progress"}                      -- match status != in_progress
--   {"no_round"}                             -- no current_round
--   {"unknown_action"}                       -- action not in our enum
--   {"not_in_game"}                          -- player_id is neither p1 nor p2
--   {"cant_afford", ki}                      -- ki below cost
--   {"stored", turn_number}                  -- action stored, waiting for other
--   {"resolve", turn_number, p1, p2}         -- both submitted — caller must resolveTurn

local raw = redis.call("GET", KEYS[1])
if not raw then return {"missing"} end

local sess = cjson.decode(raw)
if sess.game_state.status ~= "in_progress" then return {"not_in_progress"} end
local cr = sess.game_state.current_round
if cr == nil or cr == cjson.null then return {"no_round"} end

local pid = ARGV[1]
local action = ARGV[2]
local ttl = tonumber(ARGV[3])

local costs = {charge=0, block=0, attack=1, energy_wave=3, teleport=1}
local cost = costs[action]
if cost == nil then return {"unknown_action"} end

local is_p1 = pid == sess.player1_id
local is_p2 = pid == sess.player2_id
if not is_p1 and not is_p2 then return {"not_in_game"} end

local ki = is_p1 and cr.p1_ki or cr.p2_ki
if ki < cost then return {"cant_afford", ki} end

if is_p1 then sess.p1_action = action else sess.p2_action = action end
local turn_number = cr.turn_number + 1

local p1a = sess.p1_action
local p2a = sess.p2_action
if p1a ~= nil and p1a ~= cjson.null and p2a ~= nil and p2a ~= cjson.null then
  -- Both submitted — clear pending and signal resolve.
  sess.p1_action = cjson.null
  sess.p2_action = cjson.null
  redis.call("SET", KEYS[1], cjson.encode(sess), "EX", ttl)
  return {"resolve", turn_number, p1a, p2a}
end

redis.call("SET", KEYS[1], cjson.encode(sess), "EX", ttl)
return {"stored", turn_number}
