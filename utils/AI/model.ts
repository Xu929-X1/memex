import { ChatOpenAI, ChatOpenAIFields } from "@langchain/openai"
import { ChatAnthropic, ChatAnthropicInput } from "@langchain/anthropic";
export type LLM = "openai" | "anthropic";
export const createOpenAIModel = (config: Partial<ChatOpenAIFields>) => {
    return new ChatOpenAI(config);
}

export const createAnthropicModel = (config: Partial<ChatAnthropicInput>) => {
    return new ChatAnthropic(config);
}

export type ModelConfig<T extends LLM> = T extends "openai"
    ? Partial<ChatOpenAIFields>
    : Partial<ChatAnthropicInput>

type ModelReturn<T extends LLM> = T extends "openai" ? ChatOpenAI : ChatAnthropic

export function createModel<T extends LLM>(type: T, config: ModelConfig<T>): ModelReturn<T> {
    switch (type) {
        case "anthropic":
            return createAnthropicModel(config as Partial<ChatAnthropicInput>) as ModelReturn<T>
        case "openai":
            return createOpenAIModel(config as Partial<ChatOpenAIFields>) as ModelReturn<T>
    }
}