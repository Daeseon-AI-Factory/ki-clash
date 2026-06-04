# ─────────────────────────────────────────────────────────────────────────────
# variables.tf — 모든 입력값(knobs). 코드는 안 바꾸고 terraform.tfvars 로 조절.
#
# 운영 개념: 환경별로 값만 다르고 코드는 동일해야 한다(dev/staging/prod).
#            그래서 region/instance_type/domain 등을 변수로 빼낸다.
# ─────────────────────────────────────────────────────────────────────────────

variable "project" {
  description = "리소스 이름/태그 prefix. 모든 AWS 리소스에 붙어서 콘솔에서 식별 가능."
  type        = string
  default     = "jjan"
}

variable "region" {
  description = "AWS 리전. 한국 audience → 서울(ap-northeast-2)이 레이턴시 최적."
  type        = string
  default     = "ap-northeast-2"
}

variable "instance_type" {
  description = <<-EOT
    EC2 인스턴스 크기.
    t3.micro  = 2 vCPU(버스트) / 1GB RAM — 프리티어, 데모/초기.
    t3.small  = 2 vCPU / 2GB — 100+ 동접 가면 업그레이드.
    EBS 분리했으니 타입 변경 시 데이터 안전(detach→attach).
  EOT
  type        = string
  default     = "t3.micro"
}

variable "root_volume_size_gb" {
  description = "루트 볼륨(OS+Docker 이미지). 일회용이라 작게. 20GB면 충분."
  type        = number
  default     = 20
}

variable "data_volume_size_gb" {
  description = "데이터 볼륨(Postgres+Redis). 영구 보존. 초기 10GB, 부족하면 온라인 확장 가능."
  type        = number
  default     = 10
}

variable "ssh_public_key_path" {
  description = <<-EOT
    너 로컬의 SSH 공개키 경로. 이 키로만 EC2 SSH 접속 가능.
    없으면: ssh-keygen -t ed25519 -f ~/.ssh/jjan_aws
    그럼 경로는 ~/.ssh/jjan_aws.pub
  EOT
  type        = string
  default     = "~/.ssh/jjan_aws.pub"
}

variable "my_ip_cidr" {
  description = <<-EOT
    SSH(22번 포트) 허용할 너 IP. 보안: 전세계(0.0.0.0/0)에 SSH 열면 봇이 두들김.
    확인: curl -s https://checkip.amazonaws.com  →  거기에 /32 붙임 (예: 1.2.3.4/32)
  EOT
  type        = string
}

variable "domain" {
  description = "백엔드 API 도메인. Caddy가 이걸로 Let's Encrypt SSL 자동 발급."
  type        = string
  default     = "api.jjan.daeseon.ai"
}
