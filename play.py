"""Interactive CLI to play Ki Clash vs AI in terminal."""

import sys

from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import (
    Action,
    ACTION_KI_COST,
    Difficulty,
    MatchStatus,
    MatchType,
    RoundWinner,
    TurnOutcome,
)
from app.core.ai_opponent.base import create_ai_opponent

ACTION_DISPLAY = {
    Action.CHARGE: "Charge (기 모으기)",
    Action.BLOCK: "Block (막기)",
    Action.ATTACK: "Attack (파)",
    Action.ENERGY_WAVE: "Ki Burst (기폭)",
    Action.TELEPORT: "Teleport (순간이동)",
}

OUTCOME_DISPLAY = {
    TurnOutcome.P1_WINS_ROUND: "YOU WIN THE ROUND!",
    TurnOutcome.P2_WINS_ROUND: "AI WINS THE ROUND!",
    TurnOutcome.CLASH: "CLASH! Both lose ki.",
    TurnOutcome.BLOCKED: "BLOCKED!",
    TurnOutcome.DODGED: "DODGED!",
    TurnOutcome.NEUTRAL: "No effect.",
}

DIFFICULTY_MAP = {
    "1": Difficulty.EASY,
    "2": Difficulty.MEDIUM,
    "3": Difficulty.HARD,
}

MATCH_TYPE_MAP = {
    Difficulty.EASY: MatchType.AI_EASY,
    Difficulty.MEDIUM: MatchType.AI_MEDIUM,
    Difficulty.HARD: MatchType.AI_HARD,
}


def pick_difficulty() -> Difficulty:
    print("\n=== Ki Clash (기싸움) ===\n")
    print("Select difficulty:")
    print("  1. Easy   - random, charges a lot")
    print("  2. Medium - reads your patterns")
    print("  3. Hard   - game-theory optimal")
    while True:
        choice = input("\n> ").strip()
        if choice in DIFFICULTY_MAP:
            return DIFFICULTY_MAP[choice]
        print("Enter 1, 2, or 3.")


def pick_action(player_ki: int) -> Action:
    actions = list(Action)
    print("\nChoose your action:")
    for i, action in enumerate(actions, 1):
        cost = ACTION_KI_COST[action]
        affordable = player_ki >= cost
        cost_str = f"(ki cost: {cost})" if cost > 0 else "(free)"
        marker = "" if affordable else " [X not enough ki]"
        print(f"  {i}. {ACTION_DISPLAY[action]} {cost_str}{marker}")

    while True:
        choice = input("\n> ").strip()
        if choice in [str(i) for i in range(1, len(actions) + 1)]:
            action = actions[int(choice) - 1]
            if player_ki >= ACTION_KI_COST[action]:
                return action
            print(f"Not enough ki! You have {player_ki}, need {ACTION_KI_COST[action]}.")
        else:
            print(f"Enter 1-{len(actions)}.")


def display_turn_result(
    your_action: Action,
    ai_action: Action,
    outcome: TurnOutcome,
    your_ki: int,
    ai_ki: int,
) -> None:
    print(f"\n  You:  {ACTION_DISPLAY[your_action]}")
    print(f"  AI:   {ACTION_DISPLAY[ai_action]}")
    print(f"\n  >>> {OUTCOME_DISPLAY[outcome]} <<<")
    print(f"\n  Your Ki: {your_ki}  |  AI Ki: {ai_ki}")


def main() -> None:
    difficulty = pick_difficulty()
    engine = GameEngine()
    ai = create_ai_opponent(difficulty)
    state = engine.start_match(MATCH_TYPE_MAP[difficulty])

    print(f"\nMatch started! Best of 3 vs {difficulty.value.upper()} AI.")
    print("=" * 40)

    while state.status == MatchStatus.IN_PROGRESS:
        rnd = state.current_round
        assert rnd is not None

        print(f"\n--- Round {rnd.round_number} | Turn {rnd.turn_number + 1} ---")
        print(f"Score: You {state.rounds_won_p1} - {state.rounds_won_p2} AI")

        your_action = pick_action(rnd.p1_ki)
        ai_action = ai.choose_action(state, rnd.turn_history)

        state, turn_result, round_result, match_result = engine.submit_turn(
            state, your_action, ai_action
        )

        display_turn_result(
            your_action,
            ai_action,
            turn_result.outcome,
            turn_result.p1_ki_after,
            turn_result.p2_ki_after,
        )

        if round_result is not None:
            winner_str = {
                RoundWinner.P1: "YOU",
                RoundWinner.P2: "AI",
                RoundWinner.DRAW: "DRAW",
            }[round_result.winner]
            print(f"\n{'=' * 40}")
            print(f"  Round {round_result.round_number} winner: {winner_str}")
            print(f"{'=' * 40}")

        if match_result is not None:
            winner_str = {
                RoundWinner.P1: "YOU WIN THE MATCH!",
                RoundWinner.P2: "AI WINS THE MATCH!",
                RoundWinner.DRAW: "MATCH DRAW!",
            }[match_result.winner]
            print(f"\n{'*' * 40}")
            print(f"  {winner_str}")
            print(f"  Final: You {match_result.rounds_won_p1} - {match_result.rounds_won_p2} AI")
            print(f"  Total turns: {match_result.total_turns}")
            print(f"{'*' * 40}\n")

    again = input("Play again? (y/n) > ").strip().lower()
    if again == "y":
        main()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nGG!")
        sys.exit(0)
