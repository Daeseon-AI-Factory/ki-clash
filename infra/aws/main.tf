# ─────────────────────────────────────────────────────────────────────────────
# main.tf — provider 설정 + 동적 조회(data sources)
#
# 운영 개념 1: provider 버전을 고정한다(~> 5.0). 안 그러면 6개월 뒤
#   terraform init 했을 때 provider가 breaking change 된 버전으로 깔려서
#   "어제 됐는데 오늘 안 됨"이 발생. 재현성(reproducibility)의 기본.
#
# 운영 개념 2: AMI ID를 하드코딩하지 않는다. AMI는 리전마다 다르고
#   매주 새 빌드가 나온다. data source로 "항상 최신 Ubuntu 24.04"를
#   런타임에 조회 → 코드가 모든 리전/시점에서 동작.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # 5.x 안에서만 업데이트 (6.0 breaking change 차단)
    }
  }

  # NOTE: 지금은 state를 로컬 파일(terraform.tfstate)에 저장.
  # 운영/팀 단계에서는 S3 + DynamoDB lock으로 옮긴다(원격 state).
  # 혼자 배우는 단계라 로컬로 시작 — 나중에 backend 블록 추가하면 됨.
}

provider "aws" {
  region = var.region
  default_tags {
    # 모든 리소스에 자동으로 붙는 태그. 콘솔에서 "이거 뭐였지" 방지 +
    # 비용 추적(Cost Explorer에서 project별 필터) 가능.
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}

# ── 최신 Ubuntu 24.04 LTS AMI 동적 조회 ──────────────────────────────────────
# owner 099720109477 = Canonical(우분투 공식 발행처). 이 owner로 필터링해야
# 누군가 "ubuntu"라고 이름 붙인 악성 AMI를 잡지 않는다(공급망 보안).
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── 가용 영역(AZ) 조회 ───────────────────────────────────────────────────────
# AZ = 한 리전 안의 물리적으로 분리된 데이터센터(서울은 a/b/c/d).
# 단일 인스턴스라 첫 번째 AZ만 쓴다. EBS 볼륨과 EC2는 같은 AZ여야
# attach 가능(EBS는 AZ에 묶임) — 그래서 둘 다 같은 AZ로 못박는다.
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  az = data.aws_availability_zones.available.names[0]
}
