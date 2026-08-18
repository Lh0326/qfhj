package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Weekly Study Time Response - 每周每日平均练习时长响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeeklyStudyTimeResponse {

    private List<DailyStudyTime> dailyAverage;

    private String totalTimeFormatted;

    private int totalRecords;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyStudyTime {
        private int dayOfWeek;
        private String dayName;
        private double averageTimeSeconds;
        private String averageTimeFormatted;
        private int recordCount;
    }
}
