package com.smarttcm.security;

import com.smarttcm.entity.User;
import com.smarttcm.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Superuser Details Service - 超级用户认证服务
 * 支持基于 isSuperuser 标志的权限认证
 */
@Service
public class SuperuserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public SuperuserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + username));

        return new SuperuserUserDetails(user);
    }

    private static class SuperuserUserDetails implements UserDetails {

        private final User user;

        public SuperuserUserDetails(User user) {
            this.user = user;
        }

        @Override
        public String getUsername() {
            return user.getUsername();
        }

        @Override
        public String getPassword() {
            return user.getHashedPassword();
        }

        @Override
        public java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> getAuthorities() {
            if (Boolean.TRUE.equals(user.getIsSuperuser())) {
                return java.util.List.of(
                        new SimpleGrantedAuthority("ROLE_SUPERUSER")
                );
            }
            return Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"));
        }

        @Override
        public boolean isAccountNonExpired() { return true; }

        @Override
        public boolean isAccountNonLocked() { return Boolean.TRUE.equals(user.getIsActive()); }

        @Override
        public boolean isCredentialsNonExpired() { return true; }

        @Override
        public boolean isEnabled() { return Boolean.TRUE.equals(user.getIsActive()); }
    }
}
