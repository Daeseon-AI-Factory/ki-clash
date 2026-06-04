# ─────────────────────────────────────────────────────────────────────────────
# network.tf — VPC와 그 안의 네트워킹
#
# 큰 그림: 인터넷에서 EC2까지 패킷이 가려면 4개가 다 있어야 한다.
#   1. VPC          — 너만의 격리된 사설 네트워크 공간
#   2. Subnet       — VPC를 쪼갠 IP 구획 (이 서버가 들어갈 곳)
#   3. Internet GW  — VPC ↔ 인터넷 연결 통로
#   4. Route Table  — "인터넷행 트래픽은 IGW로 보내라"는 교통 규칙
#   + Security Group — 인스턴스 단위 방화벽 (어떤 포트 열지)
#
# 하나라도 빠지면 "인스턴스는 떴는데 접속이 안 됨" — AWS 입문자 단골 함정.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. VPC ───────────────────────────────────────────────────────────────────
# 10.0.0.0/16 = 10.0.0.0 ~ 10.0.255.255 (6.5만 개 사설 IP).
# /16은 관례적 크기. 이 안에서 subnet으로 쪼갠다.
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true # VPC 내부 DNS 해석 켜기
  enable_dns_hostnames = true # 인스턴스에 DNS 이름 부여

  tags = { Name = "${var.project}-vpc" }
}

# ── 2. Public Subnet ─────────────────────────────────────────────────────────
# 10.0.1.0/24 = 256개 IP. "public"인 이유: 아래 route table이 IGW로
# 연결돼서 공인 IP를 가진 인스턴스가 인터넷과 직접 통신 가능.
# (private subnet은 IGW route가 없어서 외부 직접 접근 불가 — DB 격리용.
#  지금은 단일 인스턴스라 public 하나면 충분.)
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = local.az
  map_public_ip_on_launch = true # 이 subnet에 뜨는 인스턴스에 공인 IP 자동 부여

  tags = { Name = "${var.project}-public-subnet" }
}

# ── 3. Internet Gateway ──────────────────────────────────────────────────────
# VPC를 인터넷에 연결하는 문. VPC에 하나만 붙으면 됨.
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-igw" }
}

# ── 4. Route Table + 연결 ────────────────────────────────────────────────────
# "0.0.0.0/0(모든 외부 목적지) 트래픽은 IGW로 보내라"는 규칙.
# 이게 없으면 subnet이 인터넷과 단절됨(= private subnet).
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project}-public-rt" }
}

# route table을 subnet에 실제로 붙이는 연결. 안 붙이면 규칙이 적용 안 됨.
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ── Security Group (인스턴스 방화벽) ──────────────────────────────────────────
# 운영 원칙: 최소 권한(least privilege). 필요한 포트만 연다.
#   22  SSH    → 너 IP만 (전세계 열면 봇이 brute-force)
#   80  HTTP   → 전세계 (Caddy가 Let's Encrypt 인증 + https 리다이렉트)
#   443 HTTPS  → 전세계 (실제 API/WebSocket 트래픽)
# DB(5432)/Redis(6379)는? → 안 연다. Docker 내부 네트워크에서만 통신.
#   외부에 DB 포트 노출 = 즉시 스캔당함. 컨테이너 간 통신은 SG 무관.
resource "aws_security_group" "web" {
  name        = "${var.project}-web-sg"
  description = "JJAN backend: SSH(me only), HTTP, HTTPS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from my IP only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
  }

  ingress {
    description = "HTTP (Caddy ACME challenge + redirect to https)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS (API + WebSocket)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # egress: 아웃바운드는 전부 허용(기본값). 서버가 docker pull,
  # apt update, Let's Encrypt 통신 등을 해야 하므로.
  egress {
    description = "all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # 모든 프로토콜
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-web-sg" }
}
