# ─────────────────────────────────────────────────────────────────────────────
# compute.tf — EC2 인스턴스 + 분리된 데이터 볼륨 + 고정 IP
#
# 여기가 "cattle, not pets" 원칙이 실제로 구현되는 곳:
#   - EC2 + 루트 볼륨 = cattle (언제든 죽이고 재생성)
#   - 별도 EBS data 볼륨 = pet (소중히 보존, Postgres/Redis 데이터)
#   - Elastic IP = 고정 주소 (인스턴스 죽어도 IP 유지 → DNS 안 바꿔도 됨)
# ─────────────────────────────────────────────────────────────────────────────

# ── SSH 키 등록 ──────────────────────────────────────────────────────────────
# 네 로컬 공개키를 AWS에 올린다. AWS는 공개키만 보관, 개인키는 네 노트북에만.
# 인스턴스는 이 키로 서명된 SSH 접속만 허용.
resource "aws_key_pair" "deployer" {
  key_name   = "${var.project}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# ── EC2 인스턴스 ─────────────────────────────────────────────────────────────
resource "aws_instance" "web" {
  ami                    = data.aws_ami.ubuntu.id # main.tf의 동적 조회 결과
  instance_type          = var.instance_type
  availability_zone      = local.az # EBS와 같은 AZ (attach 가능하려면 필수)
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = aws_key_pair.deployer.key_name

  # 루트 볼륨 = OS + Docker 이미지. 일회용이므로 인스턴스와 운명 공동체.
  root_block_device {
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3" # 최신 SSD. gp2보다 싸고 빠름
    delete_on_termination = true  # 인스턴스 지우면 같이 삭제 (OS는 일회용)
    tags                  = { Name = "${var.project}-root" }
  }

  # user_data = 부팅 시 1회 실행되는 스크립트. Docker 설치 + data 볼륨 마운트.
  # templatefile로 변수 주입 → 스크립트가 깨끗하게 분리됨.
  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    data_device = "/dev/sdf" # 아래 volume attachment와 일치해야 함
  })

  # user_data 바뀌면 인스턴스 교체(replace). 부팅 스크립트는 1회만 도므로.
  user_data_replace_on_change = true

  tags = { Name = "${var.project}-web" }
}

# ── 분리된 데이터 볼륨 (핵심) ────────────────────────────────────────────────
# 이게 Postgres/Redis 데이터를 담는 영구 볼륨. 인스턴스와 독립적 생명주기.
resource "aws_ebs_volume" "data" {
  availability_zone = local.az # 인스턴스와 같은 AZ (필수)
  size              = var.data_volume_size_gb
  type              = "gp3"

  tags = { Name = "${var.project}-data" }

  # 운영 안전장치: terraform destroy 해도 이 볼륨은 함부로 못 지우게.
  # 실수로 destroy 쳐도 데이터 볼륨은 보호됨. 진짜 지우려면 이 줄 먼저 제거.
  lifecycle {
    prevent_destroy = true
  }
}

# 볼륨을 인스턴스에 물리적으로 연결(attach). /dev/sdf로 나타남.
# (Ubuntu에서는 보통 /dev/xvdf 또는 /dev/nvme1n1로 보임 — user_data가 처리)
resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.web.id

  # 인스턴스 죽일 때 강제 detach (안 하면 detach 멈춤 현상)
  force_detach = true
}

# ── Elastic IP (고정 공인 IP) ────────────────────────────────────────────────
# 왜 필요? 인스턴스 기본 공인 IP는 재부팅/재생성 시 바뀐다.
# DNS A 레코드(api.jjan.daeseon.ai → IP)를 매번 바꾸기 싫으면 고정 IP 필수.
# EIP는 인스턴스에 붙어있는 동안 무료, 안 붙어 떠있으면 과금(낭비 방지 설계).
resource "aws_eip" "web" {
  domain   = "vpc"
  instance = aws_instance.web.id
  tags     = { Name = "${var.project}-eip" }

  # IGW가 먼저 있어야 EIP 연결 가능
  depends_on = [aws_internet_gateway.main]
}
