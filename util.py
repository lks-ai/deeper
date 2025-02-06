from prowl import ProwlStack, prowl

models = [
    'qwen/qwen-2.5-7b-instruct',
    'mistralai/mixtral-8x7b-instruct',
]

# Main function

async def think(prompt:str, model=None):
    def stop_early(var:prowl.Variable):
        if var.name == 'stop_now':
            if "y" in var.value.lower():
                return False
    model = model or models[0]
    stack = ProwlStack(folder=["prompts/"], silent=False) #, stream_level=prowl.StreamLevel.VARIABLE, variable_event=stop_early)
    r:prowl.Return = await stack.run(['identity', 'input', 'think'], inputs={'user_request': prompt}, model=model)
    # TODO Introduce early stopping based on streaming
    d = r.get()
    thoughts = r.var('thought').hist()
    d['thought'] = "\n".join([v['value'] for v in thoughts])
    r:prowl.Return = await stack.run(['output'], prefix=r.completion, model=model, stops=['</reply>'])
    d.update(r.get())
    print(r.completion)
    return d
