package com.smarttcm.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Application Configuration - 应用通用配置
 */
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppConfig {

    private Jwt jwt = new Jwt();
    private Mail mail = new Mail();
    private Question question = new Question();
    private News news = new News();

    public static class News {
        private String cliPath;
        private int hotLimit = 10;
        private int morningLimit = 10;
        private int eveningLimit = 10;
        private int searchLimit = 10;
        private int fetchIntervalHours = 6;

        public String getCliPath() { return cliPath; }
        public void setCliPath(String cliPath) { this.cliPath = cliPath; }
        public int getHotLimit() { return hotLimit; }
        public void setHotLimit(int hotLimit) { this.hotLimit = hotLimit; }
        public int getMorningLimit() { return morningLimit; }
        public void setMorningLimit(int morningLimit) { this.morningLimit = morningLimit; }
        public int getEveningLimit() { return eveningLimit; }
        public void setEveningLimit(int eveningLimit) { this.eveningLimit = eveningLimit; }
        public int getSearchLimit() { return searchLimit; }
        public void setSearchLimit(int searchLimit) { this.searchLimit = searchLimit; }
        public int getFetchIntervalHours() { return fetchIntervalHours; }
        public void setFetchIntervalHours(int fetchIntervalHours) { this.fetchIntervalHours = fetchIntervalHours; }
    }

    public static class Jwt {
        private String secret;
        private long expiration = 86400000;
        private String algorithm = "HS256";

        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public long getExpiration() { return expiration; }
        public void setExpiration(long expiration) { this.expiration = expiration; }
        public String getAlgorithm() { return algorithm; }
        public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }
    }

    public static class Mail {
        private String from;
        private String fromName;
        private Verification verification = new Verification();
        private ResetPassword resetPassword = new ResetPassword();

        public static class Verification {
            private int codeLength = 6;
            private int expirationMinutes = 5;
            private int maxSendPerHour = 5;

            public int getCodeLength() { return codeLength; }
            public void setCodeLength(int codeLength) { this.codeLength = codeLength; }
            public int getExpirationMinutes() { return expirationMinutes; }
            public void setExpirationMinutes(int expirationMinutes) { this.expirationMinutes = expirationMinutes; }
            public int getMaxSendPerHour() { return maxSendPerHour; }
            public void setMaxSendPerHour(int maxSendPerHour) { this.maxSendPerHour = maxSendPerHour; }
        }

        public static class ResetPassword {
            private int tokenExpirationMinutes = 30;

            public int getTokenExpirationMinutes() { return tokenExpirationMinutes; }
            public void setTokenExpirationMinutes(int tokenExpirationMinutes) { this.tokenExpirationMinutes = tokenExpirationMinutes; }
        }

        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public String getFromName() { return fromName; }
        public void setFromName(String fromName) { this.fromName = fromName; }
        public Verification getVerification() { return verification; }
        public void setVerification(Verification verification) { this.verification = verification; }
        public ResetPassword getResetPassword() { return resetPassword; }
        public void setResetPassword(ResetPassword resetPassword) { this.resetPassword = resetPassword; }
    }

    public static class Question {
        /**
         * 每次 AI 生成的最大题目数量
         */
        private int maxGenerateCount = 10;

        public int getMaxGenerateCount() { return maxGenerateCount; }
        public void setMaxGenerateCount(int maxGenerateCount) { this.maxGenerateCount = maxGenerateCount; }
    }

    public Jwt getJwt() { return jwt; }
    public void setJwt(Jwt jwt) { this.jwt = jwt; }
    public Mail getMail() { return mail; }
    public void setMail(Mail mail) { this.mail = mail; }
    public Question getQuestion() { return question; }
    public void setQuestion(Question question) { this.question = question; }
    public News getNews() { return news; }
    public void setNews(News news) { this.news = news; }
}
