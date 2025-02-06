from util import think, models

# Test Script
# ------------

if __name__ == "__main__":
    import asyncio
    
    prompts = [
"""
Assume there is a software development project. We have calculated that it takes 100 days to complete the project if there are 10 developers working with the project full time.

We want to complete the project in 25 days. How many developers we need to achieve that? a) 10 developers b) 40 developers c) 100 developers d) this is a trick question
""",
"""
Jane is older than John and John is older than Dillan.

Is Jane older than Dillan? a) yes, b) no
""",
"""
A grocery store wanted to lower costs. They observed that cashiers were only serving customers for 60% of the time. Otherwise they were being idle. So they fired 40% of the cashiers.

After a week of reducing the staff they observed their cashiers again.

Did they see: a) close to zero idleness b) close to 20% idleness c) close to 40% idleness
""",
"""
Sandra is quiet and smart. She enjoys long walks alone and literature. She even writes poems to herself.

We can't know for sure but you need to pick one option out of the following: a) Sandra is a librarian b) Sandra is a nurse
""",
"""
On a street there is a man who offers you a bet: He throws a coin and if it is tails you get $3. If it is heads you lose $1.

You take the bet and lose $100 because it is heads 100 times in a row.

Should you continue playing? a) yes b) no    
""",
    ]
    #'Come up with one truly novel and unique insight into humans'
    # 'How can I train a light RL agent on top of existing LLMs using beam search, or rather what would be the way that could make the RL agent better at choosing an answer from different seeds?'

    prompt = prompts[2]    
    model = models[1]
    r = asyncio.run(think(prompt, model=model))
    print(r)
