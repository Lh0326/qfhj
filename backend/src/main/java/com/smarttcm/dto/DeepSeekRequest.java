package com.smarttcm.dto;

import java.util.List;

/**
 * DeepSeek API Request DTO - DeepSeek AI 接口请求体
 */
public class DeepSeekRequest {

    private String model;
    private List<Message> messages;
    private double temperature;
    private int max_tokens;
    private boolean stream = false;

    public static class Message {
        private String role;
        private String content;

        public Message() {}

        public Message(String role, String content) {
            this.role = role;
            this.content = content;
        }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public List<Message> getMessages() { return messages; }
    public void setMessages(List<Message> messages) { this.messages = messages; }
    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }
    public int getMax_tokens() { return max_tokens; }
    public void setMax_tokens(int max_tokens) { this.max_tokens = max_tokens; }
    public boolean isStream() { return stream; }
    public void setStream(boolean stream) { this.stream = stream; }
}
