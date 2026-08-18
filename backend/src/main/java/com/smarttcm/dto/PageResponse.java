package com.smarttcm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Page Response DTO - 分页响应包装类
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> content;
    private long totalElements;
    private int page;
    private int size;
    private int totalPages;

    public static <T, E> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        List<T> content = page.getContent().stream()
                .map(mapper)
                .collect(Collectors.toList());
        return PageResponse.<T>builder()
                .content(content)
                .totalElements(page.getTotalElements())
                .page(page.getNumber())
                .size(page.getSize())
                .totalPages(page.getTotalPages())
                .build();
    }
}
