package com.smarttcm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User Update Request - 用户更新请求
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserUpdateRequest {

    @Email(message = "邮箱格式不正确")
    private String email;

    private String fullName;

    private Boolean isActive;

    private Boolean isSuperuser;

    private String language;

}

