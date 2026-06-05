# Backups de Prestamos

Prestamos usa SQLite en `backend/data/prestamos.db`. Este documento explica como activar backups diarios en Ubuntu con systemd.

## Archivos incluidos

```text
scripts/backup-sqlite.sh
systemd/prestamos-backup.service
systemd/prestamos-backup.timer
```

## Instalar dependencias

```bash
sudo apt update
sudo apt install -y sqlite3 gzip
```

## Activar el script

```bash
cd /opt/Prestamos
chmod +x scripts/backup-sqlite.sh
sudo mkdir -p /opt/backups/prestamos
sudo chown -R robert:robert /opt/backups/prestamos
```

## Probar backup manual

```bash
/opt/Prestamos/scripts/backup-sqlite.sh
ls -lah /opt/backups/prestamos
```

## Instalar timer de systemd

```bash
sudo cp /opt/Prestamos/systemd/prestamos-backup.service /etc/systemd/system/prestamos-backup.service
sudo cp /opt/Prestamos/systemd/prestamos-backup.timer /etc/systemd/system/prestamos-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now prestamos-backup.timer
```

## Verificar estado

```bash
systemctl list-timers --all | grep prestamos || true
sudo systemctl status prestamos-backup.timer --no-pager
sudo systemctl start prestamos-backup.service
sudo systemctl status prestamos-backup.service --no-pager
ls -lah /opt/backups/prestamos
```

## Configuracion

El backup conserva archivos por 30 dias por defecto. Se puede cambiar con `RETENTION_DAYS` en `systemd/prestamos-backup.service`.

El backup se ejecuta todos los dias a las 03:15 segun `systemd/prestamos-backup.timer`.
