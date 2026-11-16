"""001_initial_community_schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-10-17 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '001_initial'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, server_default='Traveller'),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='traveller'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_users_id', 'users', ['id'])

    # 2. destinations
    op.create_table(
        'destinations',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('hindi', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=50), server_default='heritage'),
        sa.Column('cost', sa.Integer(), server_default='0'),
        sa.Column('hours', sa.String(length=100), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('capacity', sa.Integer(), server_default='1000'),
        sa.Column('sensitivity', sa.String(length=20), server_default='normal'),
        sa.Column('base_crowd', sa.Integer(), server_default='50'),
        sa.Column('is_gem', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('alternatives', sa.JSON(), nullable=True),
    )
    op.create_index('ix_destinations_id', 'destinations', ['id'])

    # 3. crowd_reports
    op.create_table(
        'crowd_reports',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('destination_id', sa.String(length=50), sa.ForeignKey('destinations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('crowd_level', sa.String(length=20), nullable=False),
        sa.Column('vs_forecast', sa.String(length=20), nullable=True),
        sa.Column('wait_minutes', sa.Integer(), server_default='0'),
        sa.Column('tip', sa.String(length=200), nullable=True),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('forecast_score_at_report', sa.Integer(), nullable=True),
        sa.Column('moderation_status', sa.String(length=20), nullable=False, server_default='approved'),
        sa.Column('trust_weight', sa.Float(), nullable=False, server_default='1.0'),
    )
    op.create_index('ix_crowd_reports_id', 'crowd_reports', ['id'])
    op.create_index('ix_crowd_reports_user_id', 'crowd_reports', ['user_id'])
    op.create_index('ix_crowd_reports_destination_id', 'crowd_reports', ['destination_id'])
    op.create_index('ix_crowd_reports_submitted_at', 'crowd_reports', ['submitted_at'])
    op.create_index('ix_crowd_reports_moderation_status', 'crowd_reports', ['moderation_status'])
    op.create_index('idx_dest_status_submitted', 'crowd_reports', ['destination_id', 'moderation_status', 'submitted_at'])
    op.create_index('idx_user_dest_submitted', 'crowd_reports', ['user_id', 'destination_id', 'submitted_at'])

    # 4. accuracy_votes
    op.create_table(
        'accuracy_votes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('report_id', sa.Integer(), sa.ForeignKey('crowd_reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vote', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'report_id', name='uq_user_report_vote')
    )

    # 5. rewards
    op.create_table(
        'rewards',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=100), nullable=False),
        sa.Column('reference_id', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'reference_id', name='uq_user_reward_reference')
    )
    op.create_index('ix_rewards_user_id', 'rewards', ['user_id'])
    op.create_index('ix_rewards_reference_id', 'rewards', ['reference_id'])

    # 6. gem_suggestions
    op.create_table(
        'gem_suggestions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('place_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('similar_to_destination_id', sa.String(length=50), nullable=True),
        sa.Column('vibe_tags', sa.JSON(), nullable=True),
        sa.Column('fragile_flag', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('photo_url', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_gem_suggestions_status', 'gem_suggestions', ['status'])

    # 7. gem_confirmations
    op.create_table(
        'gem_confirmations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('gem_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visited_on', sa.Date(), nullable=False),
        sa.Column('worth_it', sa.Boolean(), nullable=False),
        sa.Column('crowd_level', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('gem_id', 'user_id', 'visited_on', name='uq_gem_user_visit')
    )

def downgrade() -> None:
    op.drop_table('gem_confirmations')
    op.drop_table('gem_suggestions')
    op.drop_table('rewards')
    op.drop_table('accuracy_votes')
    op.drop_table('crowd_reports')
    op.drop_table('destinations')
    op.drop_table('users')
