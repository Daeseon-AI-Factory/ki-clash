# ─────────────────────────────────────────────────────────────────────────────
# outputs.tf — apply 후 콘솔에 찍히는 값들. 다음 단계에 바로 복붙 가능하게.
# ─────────────────────────────────────────────────────────────────────────────

output "public_ip" {
  description = "Elastic IP. DNS A 레코드를 여기로 가리킨다."
  value       = aws_eip.web.public_ip
}

output "dns_record_to_create" {
  description = "Cloudflare에 추가할 DNS 레코드 (복붙용)"
  value       = "A    ${var.domain}    ${aws_eip.web.public_ip}    (Proxy OFF)"
}

output "ssh_command" {
  description = "서버 접속 명령어"
  value       = "ssh -i ~/.ssh/jjan_aws ubuntu@${aws_eip.web.public_ip}"
}

output "instance_id" {
  description = "EC2 인스턴스 ID (콘솔/CLI 조작용)"
  value       = aws_instance.web.id
}

output "data_volume_id" {
  description = "영구 데이터 볼륨 ID (스냅샷 백업 대상)"
  value       = aws_ebs_volume.data.id
}

output "next_steps" {
  description = "apply 후 할 일"
  value       = <<-EOT

    ┌─ 다음 단계 ──────────────────────────────────────────────────┐
    │ 1. DNS: Cloudflare에 위 dns_record_to_create 추가             │
    │ 2. 부팅 대기 ~2분 (user_data: Docker 설치 + 볼륨 마운트)       │
    │ 3. SSH:  위 ssh_command                                       │
    │ 4. 서버에서:                                                   │
    │      git clone https://github.com/Daeseon-AI-Factory/ki-clash.git app │
    │      cd app && cp deploy/aws-ec2/.env.prod.example .env       │
    │      # .env 편집: 시크릿 생성 + 도메인 확인                     │
    │      # docker-compose의 볼륨을 /data로 (영구 볼륨 사용)         │
    │      docker compose -f docker-compose.prod.yml up -d --build   │
    │ 5. Caddy가 SSL 자동 발급 (~1분)                                │
    │ 6. 검증: curl https://${var.domain}/health                    │
    │ 7. Vercel: NEXT_PUBLIC_API_URL=https://${var.domain} 설정      │
    └──────────────────────────────────────────────────────────────┘
  EOT
}
